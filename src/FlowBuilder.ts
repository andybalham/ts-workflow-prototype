import { FlowDefinition, ActivityFlowStep, DecisionFlowStep, LabelFlowStep, GotoFlowStep, EndFlowStep, CaseDecisionBranch, DecisionBranchTargetType, ElseDecisionBranch } from "./FlowDefinition";

export class FlowBuilder<TFlowReq, TFlowRes, TState> {

    private flowDefinition = new FlowDefinition<TFlowReq, TFlowRes, TState>();

    // TODO 07Mar20: Can we force initialise() to be first?

    initialise(initialiseState: (request: TFlowReq, state: TState) => void) {
        this.flowDefinition.initialiseState = initialiseState;
        return this;
    }

    finalise(ResponseType: new () => TFlowRes, bindResponse: (response: TFlowRes, state: TState) => void): FlowDefinition<TFlowReq, TFlowRes, TState> {
        this.flowDefinition.bindResponse = bindResponse;
        return this.flowDefinition;
    }

    perform<TReq, TRes>(stepName: string, RequestType: new () => TReq, ResponseType: new () => TRes,
        bindRequest: (request: TReq, state: TState) => void, bindState?: (response: TRes, state: TState) => void) {

        bindState = (bindState === undefined) ? (_res, _state) => { } : bindState;

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
        this.flowDefinition.steps.push(new EndFlowStep());
        return this;
    }
}

export class SwitchCaseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

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

export class SwitchElseBuilder<TDecision, TFlowReq, TFlowRes, TState> {

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

export class SwitchCaseTargetBuilder<TDecision, TFlowReq, TFlowRes, TState> {

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

export class SwitchElseTargetBuilder<TFlowReq, TFlowRes, TState> {

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

    error(getErrorMessage?: (decisionValue: any) => string): FlowBuilder<TFlowReq, TFlowRes, TState> {

        this.branch.target = {            
            type: DecisionBranchTargetType.Error,
            getErrorMessage: getErrorMessage
        };

        return this.builder;
    }
}
