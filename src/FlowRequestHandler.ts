import { FlowBuilder } from "./FlowBuilder";
import { FlowDefinition, FlowStepType, DecisionBranchTarget, DecisionBranch, DecisionBranchTargetType, FlowStep, GotoFlowStep } from "./FlowDefinition";
import { IActivityRequestHandler, FlowHandlers } from "./FlowHandlers";
import { FlowContext, ResumePoint } from "./FlowContext";
import { IFlowInstanceRepository, FlowInstance } from "./FlowInstanceRepository";

export abstract class FlowRequestHandler<TReq, TRes, TState> implements IActivityRequestHandler<TReq, TRes> {

    abstract flowName: string;

    private readonly ResponseType: new () => TRes;
    private readonly StateType: new () => TState;
    private readonly flowDefinition: FlowDefinition<TReq, TRes, TState>;

    constructor(ResponseType: new () => TRes, StateType: new () => TState) {

        this.ResponseType = ResponseType;
        this.StateType = StateType;

        this.flowDefinition = this.buildFlow(new FlowBuilder<TReq, TRes, TState>());
    }

    abstract buildFlow(flowBuilder: FlowBuilder<TReq, TRes, TState>): FlowDefinition<TReq, TRes, TState>;

    handle(parentFlowContext: FlowContext, request?: TReq): TRes {

        // TODO 10Mar20: Should we support the concept of a compensating flow on error?

        const flowContext = FlowContext.newChildContext(parentFlowContext, this.flowName, new this.StateType());

        const response = this.performFlow(flowContext, this.flowDefinition, request, flowContext.state);

        // TODO 14Mar20: Add the trace to the parent context

        return response;
    }

    protected debugPreStepState(_stepName: string, _state: any) { }
    protected debugPreActivityRequest(_stepName: string, _request: any, _state: any) { }
    protected debugPostActivityResponse(_stepName: string, _response: any, _state: any) { }
    protected debugPostStepState(_stepName: string, _state: any) { }

    private performFlow(flowContext: FlowContext, flowDefinition: FlowDefinition<TReq, TRes, TState>, request: TReq, state: TState): TRes {

        let stepIndex: number;

        if (flowContext.isResume) {
            stepIndex = this.getStepIndex(flowContext.resumeStepName, this.flowDefinition);
        }
        else {
            flowDefinition.initialiseState(request, state);
            stepIndex = 0;
        }

        while ((stepIndex !== undefined) && (stepIndex < flowDefinition.steps.length)) {

            const step = flowDefinition.steps[stepIndex];

            flowContext.stepName = step.name;

            // TODO 08Mar20: Should all logging be done via the FlowContext? I.e. assign an ILogger implementation

            this.debugPreStepState(step.name, state);

            switch (step.type) {

                case FlowStepType.Activity:
                    if (flowContext.isResume && (flowContext.resumePoints.length === 0) && (step.name === flowContext.resumeStepName)) {
                        stepIndex = this.resumeActivity(flowContext, stepIndex, step, state);
                    }
                    else {
                        stepIndex = this.performActivity(flowContext, stepIndex, step, state);
                    }
                    break;

                case FlowStepType.Decision:
                    stepIndex = this.evaluateDecision(stepIndex, step, state, flowDefinition);
                    break;

                case FlowStepType.End:
                    stepIndex = this.gotoEnd();
                    break;

                case FlowStepType.Label:
                    stepIndex = this.skipLabel(stepIndex, step);
                    break;

                case FlowStepType.Goto:
                    stepIndex = this.gotoTarget(step as GotoFlowStep, flowDefinition);
                    break;

                default:
                    throw new Error(`Unhandled FlowStepType: ${step.type}`);
            }

            this.debugPostStepState(step.name, state);
        }

        if (stepIndex === undefined) {
            return undefined;
        }

        const response = new this.ResponseType();
        flowDefinition.bindResponse(response, state);
        return response;
    }

    gotoTarget(step: GotoFlowStep, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {
        const nextStepIndex = this.getStepIndex(step.targetStepName, flowDefinition);
        return nextStepIndex;
    }

    skipLabel(stepIndex: number, _step: FlowStep): number {
        return stepIndex + 1;
    }

    private gotoEnd(): number {
        return Number.MAX_SAFE_INTEGER;
    }

    private evaluateDecision(stepIndex: number, step: any, state: TState, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {

        const decisionValue = step.getValue(state);

        let trueBranch: any;

        for (const caseBranch of step.caseBranches) {

            if (caseBranch.isTrue(decisionValue)) {
                trueBranch = caseBranch;
                break;
            }
        }

        const decisionBranch: DecisionBranch = (trueBranch === undefined) ? step.elseBranch : trueBranch;

        const nextStepIndex = this.getNextStepIndex(decisionBranch.target, stepIndex, flowDefinition);

        return nextStepIndex;
    }

    private getNextStepIndex(target: DecisionBranchTarget, currentStepIndex: number, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {

        let nextStepIndex: number;

        switch (target.type) {
            case DecisionBranchTargetType.Continue:
                nextStepIndex = currentStepIndex + 1;
                break;

            case DecisionBranchTargetType.End:
                nextStepIndex = Number.MAX_SAFE_INTEGER;
                break;

            default:
                nextStepIndex = this.getStepIndex(target.stepName, flowDefinition);
                break;
        }

        return nextStepIndex;
    }

    private getStepIndex(targetStepName: string, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {

        // TODO 07Mar20: Can we have a quicker index lookup?
        const nextStepIndex = flowDefinition.steps.findIndex(step => step.name === targetStepName);

        if (nextStepIndex === -1) throw new Error(`No step could be found with the name: ${targetStepName}`);

        return nextStepIndex;
    }

    private performActivity(flowContext: FlowContext, stepIndex: number, step: any, state: TState): number {

        const stepRequest = new step.RequestType();
        step.bindRequest(stepRequest, state);

        this.debugPreActivityRequest(step.name, stepRequest, state);

        const stepResponse = flowContext.handlers.sendRequest(flowContext, step.RequestType, stepRequest);

        if (stepResponse === undefined) {
            flowContext.saveInstance();
            return undefined;
        }

        step.bindState(stepResponse, state);

        this.debugPostActivityResponse(step.name, stepResponse, state);

        return stepIndex + 1;
    }

    private resumeActivity(flowContext: FlowContext, stepIndex: number, step: any, state: TState): number {

        const stepResponse = flowContext.asyncResponse;

        step.bindState(stepResponse, state);

        this.debugPostActivityResponse(step.name, stepResponse, state);

        // TODO 16Mar20: Mark the async response as being handled
        flowContext.isResume = false;

        return stepIndex + 1;
    }
}
