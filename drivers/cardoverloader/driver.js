'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    

class CardOverloaderDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('CardOverloaderDriver has been initialized');        
    }


    async onPairListDevices(data)
    {
        return {
            "name": 'Card Overloader',
            data:
            {
                "id": uuidv4()
            }
        };
    }
}

module.exports = CardOverloaderDriver;