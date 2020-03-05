import { ActivityRequest } from "./FlowRequest";

export class FlowDefinition<TFlowReq extends ActivityRequest<TFlowRes>, TFlowRes, TState> {

    initialiseState: (request: TFlowReq, state: TState) => void;
    steps: any[] = [];
    bindResponse: (response: TFlowRes, state: TState) => void;

    start(initialiseState: (request: TFlowReq, state: TState) => void) {
        this.initialiseState = initialiseState;
        return this;
    }

    end(ResponseType: new () => TFlowRes, bindResponse: (response: TFlowRes, state: TState) => void) {
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

    // _switch<TSwitch>(stepName: string, getSwitchValue: (state: TState) => TSwitch): SwitchWhenBuilder<TSwitch, TState> {
    //     return new SwitchWhenBuilder<TSwitch, TState>(this);
    // }

    // switchOn<TSwitch>(stepName: string, getSwitchValue: (state: TState) => TSwitch, buildWhen: (when: SwitchWhenBuilder<TSwitch, TState>) => void): SwitchElseBuilder<TState> {
    //     return new SwitchElseBuilder(this);
    // }
}

// export class SwitchWhenBuilder<TSwitch, TState> {

//     private builder: FlowBuilder<TState>;

//     constructor(builder: FlowBuilder<TState>) {
//         this.builder = builder;
//     }

//     equal(target: TSwitch): SwitchBranchTargetBuilder<TSwitch, TState> {
//         return new SwitchBranchTargetBuilder(this);
//     }

//     true(targetFunction: (switchValue: TSwitch) => boolean): SwitchBranchTargetBuilder<TSwitch, TState> {
//         return new SwitchBranchTargetBuilder(this);
//     }
// }

// export class SwitchElseBuilder<TState> {

//     private builder: FlowBuilder<TState>;

//     constructor(builder: FlowBuilder<TState>) {
//         this.builder = builder;
//     }

//     else(): SwitchElseTargetBuilder<TState> {
//         return new SwitchElseTargetBuilder(this.builder);
//     }
// }

// export class SwitchBranchTargetBuilder<TSwitch, TState> {

//     private builder: SwitchWhenBuilder<TSwitch, TState>;

//     constructor(builder: SwitchWhenBuilder<TSwitch, TState>) {
//         this.builder = builder;
//     }

//     goto(stepName: string): SwitchWhenBuilder<TSwitch, TState> {
//         return this.builder;
//     }

//     continue(): SwitchWhenBuilder<TSwitch, TState> {
//         return this.builder;
//     }
// }

// export class SwitchElseTargetBuilder<TState> {

//     private builder: FlowBuilder<TState>;

//     constructor(builder: FlowBuilder<TState>) {
//         this.builder = builder;
//     }

//     goto(stepName: string): FlowBuilder<TState> {
//         return this.builder;
//     }

//     continue(): FlowBuilder<TState> {
//         return this.builder;
//     }
// }