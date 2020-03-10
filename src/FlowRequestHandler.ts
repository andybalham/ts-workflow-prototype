import { FlowBuilder } from "./FlowBuilder";
import { FlowDefinition, FlowStepType, DecisionBranchTarget, DecisionBranch, DecisionBranchTargetType, FlowStep, GotoFlowStep } from "./FlowDefinition";
import { IActivityRequestHandler, FlowMediator } from "./FlowMediator";
import { FlowContext } from "./FlowContext";

export abstract class FlowRequestHandler<TReq, TRes, TState> implements IActivityRequestHandler<TReq, TRes> {

    abstract flowName: string;

    private readonly ResponseType: new () => TRes;
    private readonly StateType: new () => TState;
    private readonly flowDefinition: FlowDefinition<TReq, TRes, TState>;
    private readonly mediator: FlowMediator;

    constructor(ResponseType: new () => TRes, StateType: new () => TState, mediator: FlowMediator) {
        
        this.ResponseType = ResponseType;
        this.StateType = StateType;

        this.flowDefinition = this.buildFlow(new FlowBuilder<TReq, TRes, TState>());

        this.mediator = mediator;
    }

    abstract buildFlow(flowBuilder: FlowBuilder<TReq, TRes, TState>): FlowDefinition<TReq, TRes, TState>;

    handle(flowContext: FlowContext, request: TReq): TRes {

        // TODO 08Mar20: Should we create a sub-context if there is a sub-flow?
        // TODO 08Mar20: If we persist the state, then we would need to store two different states for parent and child

        flowContext.flowName = this.flowName;

        const state = new this.StateType();

        // TODO 10Mar20: Should we support the concept of a compensating flow on error?

        const response = this.performFlow(flowContext, this.flowDefinition, request, state);

        return response;
    }

    private performFlow(flowContext: FlowContext, flowDefinition: FlowDefinition<TReq, TRes, TState>, request: TReq, state: TState): TRes {

        flowDefinition.initialiseState(request, state);

        let stepIndex = 0;

        // TODO 08Mar20: We could restart from here, once the response has been processed

        while (stepIndex < flowDefinition.steps.length) {

            const step = flowDefinition.steps[stepIndex];

            flowContext.addStep(step);

            // TODO 08Mar20: Should all logging be done via the FlowContext? I.e. assign an ILogger implementation

            switch (step.type) {

                case FlowStepType.Activity:
                    // TODO 08Mar20: How could we recognise that we need to store the state and the context?
                    stepIndex = this.performActivity(flowContext, stepIndex, step, state);
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

        // TODO 05Mar20: How could we pick up that we need to store the state and await the response? flowContext?
        const stepResponse = this.mediator.sendRequest(flowContext, step.RequestType, stepRequest);

        step.bindState(stepResponse, state);

        return stepIndex + 1;
    }
}
