const defaultId = "__def_id"
const {HomeyAPI} = require('athom-api');
const _ = require('lodash');

class homeyApi {
    static init(homey) {
        this.homey = homey;
    }
    static async getHomeyAPI(id) {
        id = id || defaultId;
		if(!this.apis) this.apis = {};
		if(!this.apis[id]) this.apis[id] = await HomeyAPI.forCurrentHomey(this.homey);
		return this.apis[id];
    }
    static async refreshHomeyAPI(id) {
        id = id || defaultId;	
		if(!this.apis) this.apis = {};
		if(true || !this.apis[id]) this.apis[id] = await HomeyAPI.forCurrentHomey(this.homey);
		return this.apis[id];
    }
	static async clearHomeyAPI(id) {
		if(id && this.apis) delete this.apis[id];
    }

    static async getFlows(refresh) {
        if(!this.flows || refresh) 
            var api = await this.getHomeyAPI();
            if(!api || !api.flow) api = await this.refreshHomeyAPI();
            this.flows = await api.flow.getFlows();            
        return this.flows;
    }
    static async getFlow({id}) {
        return (await this.refreshHomeyAPI()).flow.getFlow({id:id});
    }

    static async getOwnTriggerFlows({refresh=false, args, id: triggerCardId}) {
        if(!this.ownFlows || refresh) {
            var flows = await this.getFlows(refresh);            
            this.ownFlows = flows ? _.filter(flows, x=>x.trigger.uri=='homey:app:nl.qluster-it.FlowEnhancer') : null
        }
        if(!this.ownFlows) return null;
        var ownFlows = this.ownFlows;
        if(args && Object.keys(args).length > 0) {
            var toFindArgsCount = {};
            for (let argI = 0; argI < args.length; argI++) {
                const arg = args[argI];
                if(!arg.name.startsWith('arg_')) continue;
                var argNumber = Number.parseInt(arg.name.split('_')[1]);
                if(toFindArgsCount[arg.type]===undefined) toFindArgsCount[arg.type] = argNumber;
                else if(argNumber>toFindArgsCount[arg.type]) toFindArgsCount[arg.type] = argNumber;
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
        if(triggerCardId) ownFlows = _.filter(ownFlows, f=>f.trigger.id==triggerCardId);
        return ownFlows;
    }

    static async triggerFlow(opt){//}, tokens) {

        var flow = await this.getFlow(opt);
        if(!flow) return null;
        
        return Global.Current.homeyOAuthClient.triggerFlow({id:flow.id});//, state:tokens});
       
    }
}


module.exports = homeyApi;