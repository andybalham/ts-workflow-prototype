import { expect } from "chai";
import { ActivityRequest, ActivityRequestHandler } from "../src/FlowRequest";
import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { Mediator } from "../src/Mediator";
import { FlowBuilder } from "../src/FlowBuilder";

class SumActivityRequest extends ActivityRequest<SumActivityResponse> {
    constructor() { super(SumActivityRequest, SumActivityResponse); }
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SumActivityHandler extends ActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    
    constructor() {
        super(SumActivityRequest);
    }

    public handle(request: SumActivityRequest): SumActivityResponse {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class SumFlowRequest extends ActivityRequest<SumFlowResponse> {
    constructor() { super(SumFlowRequest, SumFlowResponse); }
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
    
    constructor(mediator: Mediator) {        
        super(SumFlowRequest, SumFlowResponse, SumFlowState, mediator);
    }

    build(flowBuilder: FlowBuilder<SumFlowRequest, SumFlowResponse, SumFlowState>): void {
        flowBuilder
            .initialise((req, state) => {
                state.total = 0;
                state.a = req.a;
                state.b = req.b;
                state.c = req.c;
            })

            .perform("Sum_a_and_b", SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.a, state.b]; },
                (res, state) => { state.total = res.total; })

            .perform("Sum_total_and_c", SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.total, state.c]; },
                (res, state) => { state.total = res.total; })

            .finalise(SumFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

describe('Mediator', () => {

    it('returns the total of the inputs', () => {

        // TODO 04Mar20: What would be the best way to register these handlers?
        const mediator = new Mediator();
        mediator
            .registerHandler(new SumFlowHandler(mediator))
            .registerHandler(new SumActivityHandler());

        const request = new SumFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        const response = mediator.sendRequest(request) as SumFlowResponse;

        expect(response?.total).to.be.equal(616);
    });
});