import { FlowBuilder } from "./FlowBuilder";
import { FlowDefinition, FlowStepType, DecisionBranchTarget, DecisionBranch, DecisionBranchTargetType, FlowStep, GotoFlowStep } from "./FlowDefinition";
import { IActivityRequestHandler, FlowHandlers } from "./FlowHandlers";
import { FlowContext, FlowInstanceStackFrame } from "./FlowContext";
import uuid = require("uuid");

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

    handle(flowContext: FlowContext, request?: TReq): TRes {

        let wasResume: boolean;
        let isRoot: boolean;
        
        if (flowContext.isResume) {
            wasResume = flowContext.isResume;
            isRoot = (flowContext.resumeStackFrames.length === flowContext.resumeStackFrameCount);
            flowContext.stackFrames.push(flowContext.resumeStackFrames.pop());
        } else {
            wasResume = false;
            isRoot = (flowContext.stackFrames.length === 0);
            flowContext.stackFrames.push(new FlowInstanceStackFrame(this.flowName, new this.StateType()));
        }

        const response = this.performFlow(flowContext, this.flowDefinition, request);

        const hasResponse = response !== undefined;

        if (hasResponse) {

            flowContext.stackFrames.pop();

            if (isRoot && wasResume) {
                flowContext.deleteInstance();
            }

        } else if (isRoot) {
            
            flowContext.saveInstance();
        }

        return response;
    }

    protected debugPreStepState(_stepName: string, _state: any) { }
    protected debugPreActivityRequest(_stepName: string, _request: any, _state: any) { }
    protected debugPostActivityResponse(_stepName: string, _response: any, _state: any) { }
    protected debugPostStepState(_stepName: string, _state: any) { }

    private performFlow(flowContext: FlowContext, flowDefinition: FlowDefinition<TReq, TRes, TState>, request: TReq): TRes {

        let stepIndex: number;

        if (flowContext.isResume) {
            stepIndex = this.getStepIndex(flowContext.currentStackFrame.stepName, this.flowDefinition);
        } else {
            flowDefinition.initialiseState(request, flowContext.currentStackFrame.state);
            stepIndex = 0;
        }

        while ((stepIndex !== undefined) && (stepIndex < flowDefinition.steps.length)) {

            const step = flowDefinition.steps[stepIndex];

            flowContext.currentStackFrame.stepName = step.name;

            // TODO 08Mar20: Should all logging be done via the FlowContext? I.e. assign an ILogger implementation

            this.debugPreStepState(step.name, flowContext.currentStackFrame.state);

            switch (step.type) {

                case FlowStepType.Activity:
                    if (flowContext.isResume && (flowContext.resumeStackFrames.length === 0) && (step.name === flowContext.currentStackFrame.stepName)) {
                        stepIndex = this.resumeActivity(flowContext, stepIndex, step);
                    }
                    else {
                        stepIndex = this.performActivity(flowContext, stepIndex, step);
                    }
                    break;

                case FlowStepType.Decision:
                    stepIndex = this.evaluateDecision(stepIndex, step, flowContext.currentStackFrame.state, flowDefinition);
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

            this.debugPostStepState(step.name, flowContext.currentStackFrame.state);
        }

        if (stepIndex === undefined) {
            return undefined;
        }

        const response = new this.ResponseType();
        flowDefinition.bindResponse(response, flowContext.currentStackFrame.state);
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

        const nextStepIndex = this.getNextStepIndex(decisionBranch.target, stepIndex, flowDefinition, decisionValue);

        return nextStepIndex;
    }

    private getNextStepIndex(target: DecisionBranchTarget, currentStepIndex: number, flowDefinition: FlowDefinition<TReq, TRes, TState>, decisionValue: any): number {

        let nextStepIndex: number;

        switch (target.type) {
            case DecisionBranchTargetType.Continue:
                nextStepIndex = currentStepIndex + 1;
                break;

            case DecisionBranchTargetType.Goto:
                nextStepIndex = this.getStepIndex(target.stepName, flowDefinition);
                break;

            case DecisionBranchTargetType.End:
                nextStepIndex = Number.MAX_SAFE_INTEGER;
                break;

            default:
                throw new Error(target.getErrorMessage(decisionValue));
        }

        return nextStepIndex;
    }

    private getStepIndex(targetStepName: string, flowDefinition: FlowDefinition<TReq, TRes, TState>): number {

        // TODO 07Mar20: Can we have a quicker index lookup?
        const nextStepIndex = flowDefinition.steps.findIndex(step => step.name === targetStepName);

        if (nextStepIndex === -1) throw new Error(`No step could be found with the name: ${targetStepName}`);

        return nextStepIndex;
    }

    private performActivity(flowContext: FlowContext, stepIndex: number, step: any): number {

        const stepRequest = new step.RequestType();
        step.bindRequest(stepRequest, flowContext.currentStackFrame.state);

        this.debugPreActivityRequest(step.name, stepRequest, flowContext.currentStackFrame.state);

        const stepResponse = flowContext.handlers.sendRequest(flowContext, step.RequestType, stepRequest);

        if (stepResponse === undefined) {
            return undefined;
        }

        step.bindState(stepResponse, flowContext.currentStackFrame.state);

        this.debugPostActivityResponse(step.name, stepResponse, flowContext.currentStackFrame.state);

        return stepIndex + 1;
    }

    private resumeActivity(flowContext: FlowContext, stepIndex: number, step: any): number {

        const stepResponse = flowContext.asyncResponse;

        step.bindState(stepResponse, flowContext.currentStackFrame.state);

        this.debugPostActivityResponse(step.name, stepResponse, flowContext.currentStackFrame.state);

        delete flowContext.asyncResponse;

        return stepIndex + 1;
    }
}
