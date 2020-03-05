import { ActivityRequest, ActivityRequestHandler } from "./FlowRequest";

export class Mediator {
    
    private handlerMap = new Map<string, any>();

    public registerHandler<T extends ActivityRequestHandler<TReq, TRes>, TReq extends ActivityRequest<TRes>, TRes>(handler: T) {

        this.handlerMap[handler.key] = handler;

        return this;
    }

    public sendRequest<TReq extends ActivityRequest<TRes>, TRes>(request: TReq) : TRes {

        const requestHandlerKey = request.handlerKey;

        const handler = this.handlerMap[requestHandlerKey];
     
        if (handler === undefined) {
            throw `No handler found for: ${requestHandlerKey}`;
        }

        const response = handler.handle(request);
        
        return response;
    }
}
