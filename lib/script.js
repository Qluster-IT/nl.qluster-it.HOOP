const Homey = require('homey');

/**
 * 
 */
class Script {
    static init(app) {
        this.app = app;
        this.homey = app.homey;
        this.log=app.log.bind(app);
        this.error=app.error.bind(app);
    }

    static async execute(script) {
        let args = [...arguments];
        args.shift();
        
        if(!this.homeyScript) this.homeyScript = await this.homey.api.getApiApp('com.athom.homeyscript');
        var r = await this.homeyScript.post('script/'+script+'/run', {args:args});        
        return r;
    }
}
module.exports = Script