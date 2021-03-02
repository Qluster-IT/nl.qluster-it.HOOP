const defaultId = "__def_id"
const {HomeyAPI, AthomCloudAPI} = require('athom-api');
const _ = require('lodash');
const Script = require('./script');

class homeyApi {
    static init(app) {
        this.app = app;
        this.homey = app.homey;
        this.log=app.log.bind(app);
        this.error=app.error.bind(app);
    }

    static async getHomeyAPI(id) {
        id = id || defaultId;
		if(!this.apis) this.apis = {};
		if(!this.apis[id]) this.apis[id] = await this._gethomey();// await HomeyAPI.forCurrentHomey(this.homey, (await Script.execute('HOOP_GetToken')).returns);
		return this.apis[id];
    }
    static async refreshHomeyAPI(id) {
        id = id || defaultId;	
		if(!this.apis) this.apis = {};
		if(true || !this.apis[id]) this.apis[id] = await this._gethomey();
		return this.apis[id];
    }

    static async _gethomey() {
        if(!this.token) this.token = await Script.getToken();
        try {
            return await HomeyAPI.forCurrentHomey(this.homey, this.token);
        } catch (error) {
            this.token = await Script.getToken(true);
            return await HomeyAPI.forCurrentHomey(this.homey, this.token);
        }        
    }

    // static async getHomeyAPIElevated() {
    //     this.localURL = await this.homey.api.getLocalUrl();
    //     this.sessionToken = (await Script.execute('HOOP_GetToken'));// await this.homey.api.getOwnerApiToken();
    //     this.log('this.sessionToken', this.sessionToken);
    //     const api = new HomeyAPI({
    //         localUrl: this.localURL,
    //         baseUrl: this.localURL,
    //         token: this.sessionToken,
    //         apiVersion: 2,
    //         online: true
    //       },
    //       () => {
    //         // called by HomeyAPI on 401 requests
    //          Script.execute('HOOP_GetToken').then(token=> {
    //             this.sessionToken = token;
    //             api.setToken(token);
    //          })
    //       }
    //     );
    
    //     return api;
    //   }

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

    // static async getOwnTriggerFlows({refresh=false, device, args, triggerCardId, cardId, overloadable=false}) {
    //     if(device) {
    //         device = _.find(await (await this.getHomeyAPI()).devices.getDevices(), x=> device.id ? x.id==device.id : x.data.id== device.getData().id);
    //     }

    //     if(!this.ownFlows || !this.ownFlows.length || refresh) {
    //         var flows = await this.getFlows(refresh);
    //         this.log('uri',(device? 'homey:device:'+ device.id : 'homey:app:nl.qluster-it.FlowEnhancer'));
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

    // static async triggerFlow({flow, tokens}){//}, tokens) {

    //     // var flow = await this.getFlow(opt);
    //     if(!flow) return null;
    //     try {            
    //         return (await this.getHomeyAPI()).flow.triggerFlow({id:flow.id, state: tokens});
    //     } catch (error) {
    //         this.log('Error from triggerFlow');
    //         this.log(error);
    //     }
        
        
       
    // }
}


module.exports = homeyApi;