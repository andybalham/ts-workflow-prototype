import { expect } from "chai";
import { IActivityRequestHandler, FlowMediator } from "../src/FlowMediator";
import { FlowContext } from "../src/FlowContext";

class ExampleActivityRequest {
    input: number;
}

class ExampleActivityResponse {
    output: number;
}

class ExampleHandler implements IActivityRequestHandler<ExampleActivityRequest, ExampleActivityResponse> {
    public handle(_flowContext: FlowContext, request: ExampleActivityRequest): ExampleActivityResponse {
        return { output: request.input };
    }
}

describe('Mediator', () => {

    it('Mediator can send request to handler', () => {

        const mediator = new FlowMediator();

        mediator.registerHandler(ExampleActivityRequest, ExampleActivityResponse, new ExampleHandler());

        const request = new ExampleActivityRequest();
        request.input = 616;

        const response = mediator.sendRequest(new FlowContext(), ExampleActivityRequest, request) as ExampleActivityResponse;

        expect(response).to.be.not.null;
        expect(response.output).to.be.equal(request.input);
    });

    it('Flow can be built', () => {

        // const flowBuilder = new FlowBuilder<ExampleFlowState>();

        // flowBuilder
        //     .start(ExampleFlowRequest,
        //         (req, state) => { state.value = req.input; })

        //     .perform("MyActivity", ExampleActivityRequest, ExampleActivityResponse,
        //         (req, state) => { req.input = state.value; },
        //         (res, state) => { state.value = res.output; })

        //     .switchOn("Input number", state => state.value,
        //         when => when
        //             .equal(653).goto("Summat")
        //             .true(value => value > 200).continue())
        //     .else().continue()

        //     .end(ExampleFlowResponse,
        //         (res, state) => { res.output = state.value; })
        //     ;
    });
});