const defaultId = "__def_id"
const _ = require('lodash');
const { Defer } = require("./proto");

class homeyApi {
    static init(app) {
        this.app = app;
        this.homey = app.homey;
        this.log=app.log.bind(app);
        this.error=app.error.bind(app);
        
        (async()=>{            
            this.localURL = await this.homey.api.getLocalUrl();
            this.sessionToken = await this.homey.api.getOwnerApiToken();
        }).call(this);
    }

    static async getHomeyAPI(id) {
        id = id || defaultId;
		if(!this.apis) this.apis = {};
		if(!this.apis[id]) this.apis[id] = await this._gethomey();
		return this.apis[id];
    }
    static async refreshHomeyAPI(id) {
        id = id || defaultId;	
		if(!this.apis) this.apis = {};
		if(true || !this.apis[id]) this.apis[id] = await this._gethomey();
		return this.apis[id];
    }

    static _gethomey() {
        return Promise.resolve(this.homey.drivers.getDriver('homeyelevator'));
        if(this.token && this.token.then) return this.token;
        var defer = new Defer();
        if(!this.token) {
            this.token = defer.promise;
            this.homey.drivers.getDriver('homeyelevator').getToken().then(async (token)=> {
                this.token=token;                
                this.log('token', token);
                try {
                    var r= await this.getHomeyAPINew(this.token);//forCurrentHomey(this.homey, this.token);
                    defer.resolve(r);
                    
                    this.log('defer resolved', r);
                    return ;
                } catch (error) {
                    this.token = await this.homey.drivers.getDriver('homeyelevator').getToken();
                    return defer.resolve(await this.getHomeyAPINew(this.token));//HomeyAPI.forCurrentHomey(this.homey, this.token));
                }   
            });
        } else defer.resolve(this.token);
        return defer.promise;    
    }


	static async clearHomeyAPI(id) {
		if(id && this.apis) delete this.apis[id];
    }




    static async getFlows(refresh) {
        if(!this.flows || refresh)  {
            var api = await this.getHomeyAPI();
            if(!api || !api.flow) api = await this.refreshHomeyAPI();
            this.flows = await api.flow.getFlows({$skipCache: true });     
        }       
        return this.flows;
    }
    static async getFlowCards({refresh, type}) {
        if(!this.flowCards || refresh) 
            var api = await this.getHomeyAPI();
            if(!api || !api.flow) api = await this.refreshHomeyAPI();
            this.flowCards = await api.flow[type=='actions' ? 'getFlowCardActions' : type=='conditions' ? 'getFlowCardConditions' : 'getFlowCardTriggers']();            
        return this.flowCards;
    }
    static async getFlowCard({uri, id, type}) {
        var api = await this.getHomeyAPI();
        if(!api || !api.flow) api = await this.refreshHomeyAPI();

        return await api.flow[type=='actions' ? 'getFlowCardAction' : type=='conditions' ? 'getFlowCardCondition' : 'getFlowCardTrigger']({uri, id, $skipCache: true});
    }

    static async getFlow({id}) {
        return (await this.refreshHomeyAPI()).flow.getFlow({id:id, $skipCache: true});
    }
    static async getDevice({id}) {
        return await (await this.getHomeyAPI()).devices.getDevice({id});
        //return _.find(await (await this.getHomeyAPI()).devices.getDevices(), x=> x.id==id);//(await this.refreshHomeyAPI()).flow.getFlow({id:id});
    }

    static async getOwnTriggerFlows({refresh=false, device, args, triggerCardId, cardId, overloadable=false}) {
        if(device) {
            device = _.find(await (await this.getHomeyAPI()).devices.getDevices(), x=> device.id ? x.id==device.id : x.data.id== device.getData().id);
        }

        if(!this.ownFlows || !this.ownFlows.length || refresh) {
            var flows = await this.getFlows(refresh);
            this.ownFlows = flows ? _.filter(flows, x=> x.trigger.uri==(device? 'homey:device:'+ device.id : 'homey:app:nl.qluster-it.HOOP') ) : null            
        }        
        if(!this.ownFlows) return null;
        var ownFlows = _.filter(this.ownFlows, x=> overloadable || !cardId || x.trigger.id.split('__')[1]==cardId );
        
        //&& (overloadable || !cardId || x.trigger.id.split('__')[1]==cardId )
        
        if(args && Object.keys(args).length > 0) {
            var toFindArgsCount = {};
            for (let argI = 0; argI < args.length; argI++) {
                const arg = args[argI];
                if(!arg.name.startsWith('text_') && !arg.name.startsWith('number_') && !arg.name.startsWith('boolean_')) continue;
                var argType = arg.name.split('_')[0];
                var argNumber = Number.parseInt(arg.name.split('_')[1]);
                if(toFindArgsCount[argType]===undefined) toFindArgsCount[argType] = argNumber;
                else if(argNumber>toFindArgsCount[argType]) toFindArgsCount[argType] = argNumber;
            }
            var toFindArgs = {};
            _.forEach(toFindArgsCount, (f, key)=> {
                if(!toFindArgs[key]) toFindArgs[key] = [];
                for (let i = f; i <= 3; i++) 
                    toFindArgs[key].push(key + i);
                
            });
            ownFlows = _.filter(ownFlows, f=>  _.every(toFindArgs, toFindArg=> _.some(toFindArg, toFindArgName=>  {
                return f.trigger.id.indexOf(toFindArgName)>-1
            }) ))
        }
        //this.log('ownFlows', ownFlows);
        if(triggerCardId) ownFlows = _.filter(ownFlows, f=>f.trigger.id==triggerCardId);
        return ownFlows;
    }


    
    // static async getFlows(refresh) {
    //     if(!this.flows || refresh)  {
    //         var api = await this.getHomeyAPI();
    //         if(!api || !api.flow) api = await this.refreshHomeyAPI();
    //         this.flows = await api.flow.getFlows({$skipCache: true });     
    //     }       
    //     return this.flows;
    // }
    // static async getFlowCards({refresh, type}) {
    //     if(!this.flowCards || refresh) 
    //         var api = await this.getHomeyAPI();
    //         if(!api || !api.flow) api = await this.refreshHomeyAPI();
    //         this.flowCards = await api.flow[type=='actions' ? 'getFlowCardActions' : type=='conditions' ? 'getFlowCardConditions' : 'getFlowCardTriggers']();            
    //     return this.flowCards;
    // }
    // static async getFlowCard({uri, id, type}) {
    //     var api = await this.getHomeyAPI();
    //     if(!api || !api.flow) api = await this.refreshHomeyAPI();

    //     return await api.flow[type=='actions' ? 'getFlowCardAction' : type=='conditions' ? 'getFlowCardCondition' : 'getFlowCardTrigger']({uri, id, $skipCache: true});
    // }

    // static async getFlow({id}) {
    //     return (await this.refreshHomeyAPI()).flow.getFlow({id:id, $skipCache: true});
    // }
    // static async getDevice({id}) {
    //     return await (await this.getHomeyAPI()).devices.getDevice({id});
    //     //return _.find(await (await this.getHomeyAPI()).devices.getDevices(), x=> x.id==id);//(await this.refreshHomeyAPI()).flow.getFlow({id:id});
    // }

    // static async getOwnTriggerFlows({refresh=false, device, args, triggerCardId, cardId, overloadable=false}) {
    //     if(device) {
    //         device = _.find(await (await this.getHomeyAPI()).devices.getDevices(), x=> device.id ? x.id==device.id : x.data.id== device.getData().id);
    //     }

    //     if(!this.ownFlows || !this.ownFlows.length || refresh) {
    //         var flows = await this.getFlows(refresh);
    //         this.ownFlows = flows ? _.filter(flows, x=> x.trigger.uri==(device? 'homey:device:'+ device.id : 'homey:app:nl.qluster-it.FlowEnhancer') ) : null            
    //     }        
    //     if(!this.ownFlows) return null;
    //     var ownFlows = _.filter(this.ownFlows, x=> overloadable || !cardId || x.trigger.id.split('__')[1]==cardId );
        
    //     //&& (overloadable || !cardId || x.trigger.id.split('__')[1]==cardId )
        
    //     if(args && Object.keys(args).length > 0) {
    //         var toFindArgsCount = {};
    //         for (let argI = 0; argI < args.length; argI++) {
    //             const arg = args[argI];
    //             if(!arg.name.startsWith('text_') && !arg.name.startsWith('number_') && !arg.name.startsWith('boolean_')) continue;
    //             var argType = arg.name.split('_')[0];
    //             var argNumber = Number.parseInt(arg.name.split('_')[1]);
    //             if(toFindArgsCount[argType]===undefined) toFindArgsCount[argType] = argNumber;
    //             else if(argNumber>toFindArgsCount[argType]) toFindArgsCount[argType] = argNumber;
    //         }
    //         var toFindArgs = {};
    //         _.forEach(toFindArgsCount, (f, key)=> {
    //             if(!toFindArgs[key]) toFindArgs[key] = [];
    //             for (let i = f; i <= 3; i++) 
    //                 toFindArgs[key].push(key + i);
                
    //         });
    //         ownFlows = _.filter(ownFlows, f=>  _.every(toFindArgs, toFindArg=> _.some(toFindArg, toFindArgName=>  {
    //             return f.trigger.id.indexOf(toFindArgName)>-1
    //         }) ))
    //     }
    //     //this.log('ownFlows', ownFlows);
    //     if(triggerCardId) ownFlows = _.filter(ownFlows, f=>f.trigger.id==triggerCardId);
    //     return ownFlows;
    // }
}


module.exports = homeyApi;