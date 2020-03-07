import { FlowBuilder, FlowDefinition, FlowStepType, ActivityFlowStep, DecisionFlowStep, DecisionBranchTarget, DecisionBranch, DecisionBranchTargetType } from "./FlowBuilder";
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
        this.flowDefinition.initialiseState(request, state);

        let stepIndex = 0;

        while (stepIndex < this.flowDefinition.steps.length) {

            const step = this.flowDefinition.steps[stepIndex];

            switch (step.type) {
                case FlowStepType.Activity:
                    stepIndex = this.performActivity(stepIndex, step, state);
                    break;

                case FlowStepType.Decision:
                    stepIndex = this.evaluateDecision(stepIndex, step, state);
                    break;

                case FlowStepType.End:
                    stepIndex = this.gotoEnd();
                    break;

                default:
                    throw Error(`Unhandled FlowStepType: ${step.type}`);
            }
        }

        const response = new this.ResponseType();
        this.flowDefinition.bindResponse(response, state);

        return response;
    }

    private gotoEnd(): number {
        return Number.MAX_SAFE_INTEGER;
    }

    private evaluateDecision(stepIndex: number, step: any, state: TState): number {

        const decisionValue = step.getDecisionValue(state);

        let trueBranch: any;

        for (const caseBranch of step.caseBranches) {

            if (caseBranch.isTrue(decisionValue)) {
                trueBranch = caseBranch;
                break;
            }
        }

        const decisionBranch: DecisionBranch = (trueBranch === undefined) ? step.elseBranch : trueBranch;

        const nextStepIndex = this.getNextStepIndex(decisionBranch.target, stepIndex);

        return nextStepIndex;
    }

    private getNextStepIndex(target: DecisionBranchTarget, currentStepIndex: number): number {

        let nextStepIndex: number;

        switch (target.type) {
            case DecisionBranchTargetType.Continue:
                nextStepIndex = currentStepIndex + 1;
                break;

            case DecisionBranchTargetType.End:
                nextStepIndex = Number.MAX_SAFE_INTEGER;
                break;

            default:
                nextStepIndex = this.flowDefinition.steps.findIndex(step => step.stepName === target.stepName);
                break;
        }

        if (nextStepIndex === -1) throw Error(`No step could be found with the name: ${target.stepName}`);

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
