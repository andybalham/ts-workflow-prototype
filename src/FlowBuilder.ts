import { ActivityRequest } from "./FlowRequest";

export class FlowBuilder<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    // TODO 05Mar20: Should the following be in a separate class, i.e. have a builder that outputs a definition
    initialiseState: (request: TFlowReq, state: TState) => void;
    bindResponse: (response: TFlowRes, state: TState) => void;
    steps: any[] = [];

    initialise(initialiseState: (request: TFlowReq, state: TState) => void) {
        this.initialiseState = initialiseState;
        return this;
    }

    finalise(ResponseType: new () => TFlowRes, bindResponse: (response: TFlowRes, state: TState) => void) {
        this.bindResponse = bindResponse;
    }

    perform<TReq extends ActivityRequest<TRes>, TRes>(stepName: string, RequestType: new () => TReq, ResponseType: new () => TRes,
        bindRequest: (request: TReq, state: TState) => void, bindState: (response: TRes, state: TState) => void) {

        // TODO 04Mar20: How can we switch on the type of the step, e.g. activity, decision, goto, label

        this.steps.push({
            stepName: stepName,
            RequestType: RequestType,
            ResponseType: ResponseType,
            bindRequest: bindRequest,
            bindState: bindState
        });

        return this;
    }

    switchOn<TSwitch>(stepName: string, getSwitchValue: (state: TState) => TSwitch,
        buildWhen: (when: SwitchWhenBuilder<TSwitch, TFlowReq, TFlowRes, TState>) => void): SwitchElseBuilder<TFlowReq, TFlowRes, TState> {

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

export class SwitchWhenBuilder<TSwitch, TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: FlowBuilder<TFlowReq, TFlowRes, TState>;

    constructor(builder: FlowBuilder<TFlowReq, TFlowRes, TState>) {
        this.builder = builder;
    }

    equal(target: TSwitch): SwitchBranchTargetBuilder<TSwitch, TFlowReq, TFlowRes, TState> {
        return new SwitchBranchTargetBuilder(this);
    }

    true(targetFunction: (switchValue: TSwitch) => boolean): SwitchBranchTargetBuilder<TSwitch, TFlowReq, TFlowRes, TState> {
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

export class SwitchBranchTargetBuilder<TSwitch, TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    private builder: SwitchWhenBuilder<TSwitch, TFlowReq, TFlowRes, TState>;

    constructor(builder: SwitchWhenBuilder<TSwitch, TFlowReq, TFlowRes, TState>) {
        this.builder = builder;
    }

    goto(stepName: string): SwitchWhenBuilder<TSwitch, TFlowReq, TFlowRes, TState> {
        return this.builder;
    }

    continue(): SwitchWhenBuilder<TSwitch, TFlowReq, TFlowRes, TState> {
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