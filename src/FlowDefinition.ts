import { ActivityRequest } from "./FlowRequest";

export class FlowDefinition<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {
    initialiseState: (request: TFlowReq, state: TState) => void;
    bindResponse: (response: TFlowRes, state: TState) => void;
    steps: FlowStep[] = [];
}

export enum FlowStepType {
    Activity = "Activity",
    Decision = "Decision",
    Goto = "Goto",
    Label = "Label",
    End = "End"
}

export abstract class FlowStep {

    constructor(type: FlowStepType, name?: string) {
        this.type = type;
        this.name = name;
    }

    readonly type: FlowStepType;
    readonly name: string;
}

export class ActivityFlowStep<TReq extends ActivityRequest<TRes>, TRes, TState> extends FlowStep {

    constructor(stepName: string, RequestType: new () => TReq, ResponseType: new () => TRes,
        bindRequest: (request: TReq, state: TState) => void, bindState: (response: TRes, state: TState) => void) {

        super(FlowStepType.Activity, stepName);

        this.RequestType = RequestType;
        this.ResponseType = ResponseType;
        this.bindRequest = bindRequest;
        this.bindState = bindState;
    }

    readonly RequestType: new () => TReq;
    readonly ResponseType: new () => TRes;
    readonly bindRequest: (request: TReq, state: TState) => void;
    readonly bindState: (response: TRes, state: TState) => void;
}

export class DecisionFlowStep<TDecision, TState> extends FlowStep {

    constructor(stepName: string, getValue: (state: TState) => TDecision) {

        super(FlowStepType.Decision, stepName);

        this.getValue = getValue;
        this.caseBranches = [];
        this.elseBranch = new ElseDecisionBranch();
    }

    readonly getValue: (state: TState) => TDecision;
    readonly caseBranches: CaseDecisionBranch<TDecision>[];
    readonly elseBranch: ElseDecisionBranch;
}

export class EndFlowStep extends FlowStep {
    constructor() {
        super(FlowStepType.End);
    }
}

export class LabelFlowStep extends FlowStep {
    constructor(stepName: string) {
        super(FlowStepType.Label, stepName);
    }
}

export class GotoFlowStep extends FlowStep {
    constructor(targetStepName: string) {
        super(FlowStepType.Goto);
        this.targetStepName = targetStepName;
    }
    readonly targetStepName: string;
}

export class DecisionBranch {
    target?: DecisionBranchTarget;
}

export class CaseDecisionBranch<TDecision> extends DecisionBranch {
    readonly isTrue: (value: TDecision) => boolean;
}

export class ElseDecisionBranch extends DecisionBranch {
}

export enum DecisionBranchTargetType {
    Goto = "Goto",
    Continue = "Continue",
    End = "End"
}

export class DecisionBranchTarget {
    readonly type: DecisionBranchTargetType;
    readonly stepName?: string;
}
