export class FlowMocks {

    private readonly _mockHandlers = new Map<string, (request: any) => any>();

    add<TReq, TRes>(stepName: string, mockHandler: (request: TReq) => TRes) : FlowMocks {
        this._mockHandlers.set(stepName, mockHandler);
        return this;
    }

    getResponse(stepName: string, request: any) {
        
        if (!this._mockHandlers.has(stepName)) {
            return undefined;
        }

        const mockHandler = this._mockHandlers.get(stepName);

        const mockResponse = mockHandler(request);

        return mockResponse;
    }
}