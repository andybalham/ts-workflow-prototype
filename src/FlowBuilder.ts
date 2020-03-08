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

        const activityFlowStep = new ActivityFlowStep(stepName, RequestType, ResponseType, bindRequest, bindState);

        this.flowDefinition.steps.push(activityFlowStep);

        return this;
    }

    evaluate<TDecision>(stepName: string, getValue: (state: TState) => TDecision,
        buildCases: (cases: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>) => void): SwitchElseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        const decisionFlowStep = new DecisionFlowStep(stepName, getValue);

        const switchCaseBuilder = new SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>(decisionFlowStep.caseBranches);
        buildCases(switchCaseBuilder);

        this.flowDefinition.steps.push(decisionFlowStep);

        return new SwitchElseBuilder(this, decisionFlowStep);
    }

    label(stepName: string) {
        const labelFlowStep = new LabelFlowStep(stepName);
        this.flowDefinition.steps.push(labelFlowStep);
        return this;
    }

    goto(stepName: string) {
        const gotoFlowStep = new GotoFlowStep(stepName);
        this.flowDefinition.steps.push(gotoFlowStep);
        return this;
    }

    end() {
        // TODO 07Mar20: Should we have a name for ends?
        this.flowDefinition.steps.push(new EndFlowStep());
        return this;
    }
}

export class SwitchCaseBuilder<TDecision, TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private branches: CaseDecisionBranch<TDecision>[] = [];

    constructor(branches: CaseDecisionBranch<TDecision>[]) {
        this.branches = branches;
    }

    when(isTrue: (switchValue: TDecision) => boolean): SwitchCaseTargetBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        const branch: CaseDecisionBranch<TDecision> = {
            isTrue: isTrue
        };

        this.branches.push(branch);

        return new SwitchCaseTargetBuilder(this, branch);
    }
}

export class SwitchElseBuilder<TDecision, TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;
    private step: DecisionFlowStep<TDecision, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>, step: DecisionFlowStep<TDecision, TState>) {
        this.step = step;
        this.builder = builder;
    }

    else(): SwitchElseTargetBuilder<TFlowReq, TFlowRes, TState> {
        return new SwitchElseTargetBuilder(this.builder, this.step.elseBranch);
    }
}

export class SwitchCaseTargetBuilder<TDecision, TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>;
    private branch: CaseDecisionBranch<TDecision>;

    constructor(builder: SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState>, branch: CaseDecisionBranch<TDecision>) {
        this.builder = builder;
        this.branch = branch;
    }

    goto(stepName: string): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Goto,
            stepName: stepName
        };

        return this.builder;
    }

    continue(): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Continue
        };

        return this.builder;
    }

    end(): SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.End
        };

        return this.builder;
    }
}

export class SwitchElseTargetBuilder<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private branch: ElseDecisionBranch;
    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>, branch: ElseDecisionBranch) {
        this.branch = branch;
        this.builder = builder;
    }

    goto(stepName: string): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Goto,
            stepName: stepName
        };

        return this.builder;
    }

    continue(): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.Continue
        };

        return this.builder;
    }

    end(): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {
            type: DecisionBranchTargetType.End
        };

        return this.builder;
    }
}

export enum FlowStepType {
    Activity = "Activity",
    Decision = "Decision",
    Goto = "Goto",
    Label = "Label",
    End = "End"
}

export abstract class FlowStep {

    constructor(type: FlowStepType, stepName?: string) {
        this.type = type;
        this.stepName = stepName;
    }

    readonly type: FlowStepType;
    readonly stepName: string;
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