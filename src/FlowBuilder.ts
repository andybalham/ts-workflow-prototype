import { ActivityRequest } from "./FlowRequest";

export class FlowDefinition<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {
    initialiseState: (request: TFlowReq, state: TState) => void;
    bindResponse: (response: TFlowRes, state: TState) => void;
    steps: FlowStep[] = [];
}

export class FlowBuilder<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    flowDefinition = new FlowDefinition<TFlowReq, TFlowRes, TState>();

    initialise(initialiseState: (request: TFlowReq, state: TState) => void) {
        this.flowDefinition.initialiseState = initialiseState;
        return this;
    }

    finalise(ResponseType: new () => TFlowRes, bindResponse: (response: TFlowRes, state: TState) => void) {
        this.flowDefinition.bindResponse = bindResponse;
    }

    perform<TReq extends ActivityRequest<TRes>, TRes>(stepName: string, RequestType: new () => TReq, ResponseType: new () => TRes,
        bindRequest: (request: TReq, state: TState) => void, bindState: (response: TRes, state: TState) => void) {

        const activityFlowStep: ActivityFlowStep<TReq, TRes, TState> = {
            type: FlowStepType.Activity,
            stepName: stepName,
            RequestType: RequestType,
            ResponseType: ResponseType,
            bindRequest: bindRequest,
            bindState: bindState
        };

        this.flowDefinition.steps.push(activityFlowStep);

        return this;
    }

    when<TDecision>(stepName: string, getDecisionValue: (state: TState) => TDecision,
        buildCases: (cases: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>) => void): SwitchElseBuilder<TFlowReq, TFlowRes, TState> {

        // TODO 05Mar20: How do we capture the branching?

        return new SwitchElseBuilder(this);
    }

    label(stepName: string) {
        // TODO 05Mar20: Capture the label
        return this;
    }

    goto(stepName: string) {
        // TODO 05Mar20: Capture the goto
        return this;
    }

    end() {
        // TODO 05Mar20: Capture the end
        return this;
    }
}

export class SwitchCaseBuilder<TDecision, TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>) {
        this.builder = builder;
    }

    true(targetFunction: (switchValue: TDecision) => boolean): SwitchBranchTargetBuilder<TDecision, TFlowReq, TFlowRes, TState> {
        return new SwitchBranchTargetBuilder(this);
    }
}

export class SwitchElseBuilder<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>) {
        this.builder = builder;
    }

    else(): SwitchElseTargetBuilder<TFlowReq, TFlowRes, TState> {
        return new SwitchElseTargetBuilder(this.builder);
    }
}

export class SwitchBranchTargetBuilder<TDecision, TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>;

    constructor(builder: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>) {
        this.builder = builder;
    }

    goto(stepName: string): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {
        return this.builder;
    }

    continue(): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {
        return this.builder;
    }
}

export class SwitchElseTargetBuilder<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>) {
        this.builder = builder;
    }

    goto(stepName: string): FlowBuilder<TFlowReq, TFlowRes, TState> {
        return this.builder;
    }

    continue(): FlowBuilder<TFlowReq, TFlowRes, TState> {
        return this.builder;
    }
}

export enum FlowStepType {
    Activity,
    Decision,
    Goto,
    Label,
    End
}

export abstract class FlowStep {
    readonly type: FlowStepType;
    readonly stepName: string;
}

export class ActivityFlowStep<TReq extends ActivityRequest<TRes>, TRes, TState> extends FlowStep {
    readonly RequestType: new () => TReq;
    readonly ResponseType: new () => TRes;
    readonly bindRequest: (request: TReq, state: TState) => void;
    readonly bindState: (response: TRes, state: TState) => void;
}

export class DecisionFlowStep<TDecision, TState> extends FlowStep {
    readonly getDecisionValue: (state: TState) => TDecision;
    readonly caseBranches: CaseDecisionBranch<TDecision>[];
    readonly elseBranch: ElseDecisionBranch[];
}

export class DecisionBranch {
    readonly target: DecisionBranchTarget;
}

export class CaseDecisionBranch<TDecision> extends DecisionBranch {
    readonly isTrue: (value: TDecision) => boolean;
}

export class ElseDecisionBranch extends DecisionBranch {
}

export enum DecisionBranchTargetType {
    Goto,
    Continue,
    End
}

export class DecisionBranchTarget {
    readonly type: DecisionBranchTargetType;
    readonly stepName?: string;
}