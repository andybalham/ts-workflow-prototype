import { expect } from "chai";
import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { IActivityRequestHandler, FlowMediator } from "../src/FlowMediator";
import { FlowBuilder } from "../src/FlowBuilder";
import { FlowContext } from "../src/FlowContext";

class SumActivityRequest {
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    public handle(flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class SumFlowRequest {
    a: number;
    b: number;
    c: number;
}

class SumFlowResponse {
    total: number;
}

class SumFlowState {
    a: number;
    b: number;
    c: number;
    total: number;
}

class SumFlowHandler extends FlowRequestHandler<SumFlowRequest, SumFlowResponse, SumFlowState> {

    flowName = SumFlowHandler.name;

    constructor(mediator: FlowMediator) {
        super(SumFlowResponse, SumFlowState, mediator);
    }

    buildFlow(flowBuilder: FlowBuilder<SumFlowRequest, SumFlowResponse, SumFlowState>) {
        return flowBuilder
            .initialise(
                (req, state) => {
                    state.a = req.a;
                    state.b = req.b;
                    state.c = req.c;
                    state.total = 0;
                })

            .perform("Sum_a_and_b", SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.a, state.b]; },
                (res, state) => { state.total = res.total; })

            .perform("Sum_total_and_c", SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.total, state.c]; },
                (res, state) => { state.total = res.total; })

            .finalise(SumFlowResponse,
                (res, state) => {
                    res.total = state.total;
                });
    }
}

describe('Mediator', () => {

    it('returns the total of the inputs', () => {

        const mediator = new FlowMediator();
        mediator
            .registerHandler(SumActivityRequest, SumActivityResponse, new SumActivityHandler());

        const request = new SumFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        const flowContext = new FlowContext();
        const response = new SumFlowHandler(mediator).handle(flowContext, request) as SumFlowResponse;

        expect(flowContext.flowName).to.equal(SumFlowHandler.name);
        expect(flowContext.flowInstanceId).to.be.not.undefined;
        expect(flowContext.stepTrace).to.be.not.undefined;
        expect(response?.total).to.be.equal(616);
    });
});