import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { FlowBuilder } from "../src/FlowBuilder";
import { FlowDefinition } from "../src/FlowDefinition";
import { FlowMediator, IActivityRequestHandler } from "../src/FlowMediator";
import { FlowContext } from "../src/FlowContext";
import { expect } from "chai";

class SumActivityRequest {
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    public handle(_flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class ChildFlowRequest {
    value1: number; value2: number;
}
class ChildFlowResponse {
    total: number;
}
class ChildFlowState {
    total: number;
    value1: number; value2: number;
}

class ChildFlowHandler extends FlowRequestHandler<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {

    flowName = ChildFlowHandler.name;

    constructor(mediator: FlowMediator) {
        super(ChildFlowResponse, ChildFlowState, mediator);
    }

    buildFlow(flowBuilder: FlowBuilder<ChildFlowRequest, ChildFlowResponse, ChildFlowState>): FlowDefinition<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.value1 = req.value1; state.value2 = req.value2;
            })
            .perform("Sum value 1 and 2", SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.value1, state.value2]; },
                (res, state) => { state.total = res.total; })
            .finalise(ChildFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

class ParentFlowRequest {
    a: number; b: number; c: number;
}
class ParentFlowResponse {
    total: number;
}
class ParentFlowState {
    a: number; b: number; c: number;
    total: number;
}

class ParentFlowHandler extends FlowRequestHandler<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {

    flowName = ParentFlowHandler.name;

    constructor(mediator: FlowMediator) {
        super(ParentFlowResponse, ParentFlowState, mediator);
    }

    debugPreActivityRequest(_stepName: string, _request: any, _state: any) { }
    debugPostActivityResponse(_stepName: string, _response: any, _state: any) { }

    buildFlow(flowBuilder: FlowBuilder<ParentFlowRequest, ParentFlowResponse, ParentFlowState>):
        FlowDefinition<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.a = req.a; state.b = req.b; state.c = req.c;
            })
            .perform("Add a and b", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.a; req.value2 = state.b; },
                (res, state) => { state.total = res.total; })
            .perform("Add c and total", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.c; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .finalise(ParentFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

describe('Mediator', () => {

    it('returns the total of the inputs', () => {

        const mediator = new FlowMediator();
        mediator
            .registerHandler(SumActivityRequest, SumActivityResponse, new SumActivityHandler())
            .registerHandler(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler(mediator));

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        const flowContext = new FlowContext();
        const response = new ParentFlowHandler(mediator).handle(flowContext, request) as ParentFlowResponse;

        // TODO 10Mar20: How should FlowContext go between flows?
        expect(flowContext.flowName).to.equal(ParentFlowHandler.name);
        expect(flowContext.flowInstanceId).to.be.not.undefined;
        expect(flowContext.stepTrace).to.be.not.undefined;
        expect(response?.total).to.be.equal(616);
    });
});