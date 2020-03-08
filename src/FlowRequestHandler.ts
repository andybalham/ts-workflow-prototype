import { FlowBuilder, FlowDefinition, FlowStepType, ActivityFlowStep, DecisionFlowStep, DecisionBranchTarget, DecisionBranch, DecisionBranchTargetType, FlowStep, GotoFlowStep } from "./FlowBuilder";
import { ActivityRequest, ActivityRequestHandler } from "./FlowRequest";
import { Mediator } from "./Mediator";

export abstract class FlowRequestHandler<TReq extends ActivityRequest<TRes>, TRes, TState> extends ActivityRequestHandler<TReq, TRes> {

    private ResponseType: new () => TRes;
    private StateType: new () => TState;
    private flowDefinition: FlowDefinition<TReq, TRes, TState>;
    private mediator: Mediator;

    constructor(RequestType: new () => TReq, ResponseType: new () => TRes, StateType: new () => TState, mediator: Mediator) {

        super(RequestType);

        this.ResponseType = ResponseType;
        this.StateType = StateType;

        const flowBuilder = new FlowBuilder<TReq, TRes, TState>();
        this.build(flowBuilder);
        this.flowDefinition = flowBuilder.flowDefinition;

        this.mediator = mediator;
    }

    abstract build(flowBuilder: FlowBuilder<TReq, TRes, TState>): void;

    handle(request: TReq): TRes {

        const state = new this.StateType();
        const flowDefinition = this.flowDefinition;

        // TODO 08Mar20: Surround with try/catch and run a compensating flow if one exists
        const response = this.performFlow(flowDefinition, request, state);

        return response;
    }

    private performFlow(flowDefinition: FlowDefinition<TReq, TRes, TState>, request: TReq, state: TState): TRes {

        flowDefinition.initialiseState(request, state);

        let stepIndex = 0;

        while (stepIndex < flowDefinition.steps.length) {

            const step = flowDefinition.steps[stepIndex];

            switch (step.type) {
                
                case FlowStepType.Activity:
                    stepIndex = this.performActivity(stepIndex, step, state);
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
                    throw Error(`Unhandled FlowStepType: ${step.type}`);
            }
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
        const nextStepIndex = flowDefinition.steps.findIndex(step => step.stepName === targetStepName);
        if (nextStepIndex === -1) throw Error(`No step could be found with the name: ${targetStepName}`);
        return nextStepIndex;
    }

    private performActivity(stepIndex: number, step: any, state: TState): number {

        const stepRequest = new step.RequestType();
        step.bindRequest(stepRequest, state);

        // TODO 05Mar20: How could we pick up that we need to store the state and await the response?
        const stepResponse = this.mediator.sendRequest(stepRequest);

        step.bindState(stepResponse, state);

        return stepIndex + 1;
    }
}
