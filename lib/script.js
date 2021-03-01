const Homey = require('homey');

/**
 * 
 */
class Script {
    static init(app) {
        this.app = app;
        this.homey = app.homey;
        this.log = app.log.bind(app);
        this.error = app.error.bind(app);
    }

    static async execute(script) {
        let args = [...arguments];
        args.shift();

        if (!this.homeyScript) this.homeyScript = await this.homey.api.getApiApp('com.athom.homeyscript');
        var r = await this.homeyScript.post('script/' + script + '/run', { args: args });
        return r;
    }
    static async executeCode(code) {
        let args = [...arguments];
        args.shift();
        if (!this.homeyScript) this.homeyScript = await this.homey.api.getApiApp('com.athom.homeyscript');
        var r = await this.homeyScript.post('script/HOOP_Needed/run', { code: code, args: args });
        return r;
    }


    static async getToken(refresh) {
        if (!refresh && this.token) return this.token;
        var token = null;
        try {
            this.log('TRY token');
            var r = (await this.executeCode('return Homey._token;'));//.returns;
            this.log('r', r);
            if (!r.success) token = await getToken.call(this);
            else token = r.returns;
        } catch (error) {
            token = await getToken.call(this);
            this.log('this error');
            this.error(error);
        }
        this.token = token;
        this.log('getToken', this.token);
        return this.token;

        async function getToken() {
            var token = null;
            try {
                this.log('TRY putting');
                this.homeyScript.put('script/HOOP_Needed', { code: 'This file is necessary for H.O.O.P., so dont take its Hope away.' });
                var r = (await this.executeCode('return Homey._token;'));
                if (!r.success) throw new Error("Error 1: Something when wrong.")
                else token = r.returns;
            } catch (error2) {
                this.log('this error2');
                this.error(error2);
                throw new Error("Is HomeyScript installed and active?")
            }
            return token;
        }
    }
}
module.exports = Script