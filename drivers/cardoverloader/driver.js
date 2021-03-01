'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    

class MethodGroupDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('MethodGroupDriver has been initialized');        
    }


    async onPairListDevices(data)
    {
        return {
            "name": 'Method Group',
            data:
            {
                "id": uuidv4()
            },
            settings:
            {
                "overloading": "false"
            }
        };
    }
}

module.exports = MethodGroupDriver;