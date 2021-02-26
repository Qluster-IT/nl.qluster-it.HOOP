'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');

		this.initializeActions();


  }



  initializeActions() {		
		var actionsCards = {};
		for (let actionCardIndex = 0; actionCardIndex < this.manifest.flow.actions.length; actionCardIndex++) {
			const actionCard = this.manifest.flow.actions[actionCardIndex];
			var card = new Homey.FlowCardAction(actionCard.id);			
			actionsCards[actionCard.id] = card;
			card.register();

			if(actionCard.args) {
				if(actionCard.args.find(x=>x.name=='id' && x.type=='autocomplete')) card.getArgument('id').registerAutocompleteListener(( query, args ) => {
          console.log(actionCard.id + '.id.registerAutocompleteListener: ');
					console.log(query);
					console.log(args);
					// 	return new Promise((resolve) => {
					// 			this.getSpeakersList((error, speakers) => {
					// 				if (error) {
					// 					return this.error(error);
					// 				}
					// 				console.log("Speaker fetch...");
					// 				console.log(speakers);
					// 				let result = [];
					// 				if (speakers.status == "error"){
					// 					result.push({name: "Something went wrong, please try again!", id: "NA"});
					// 				} else {
					// 					if(speakers) speakers.forEach(entry => {
					// 						const name = entry.coordinator.roomName;
					// 						result.push({name: name, id: name});
					// 					});
					// 				}
					// 				console.log("Speaker fetch...done");
					// 				resolve(result);
					// 			})
					// 	});
					});
			}
		}

		// actionsCards['action_sonos_lock_volume'].registerRunListener(( args, state ) => {
		// 	return new Promise((resolve) => {
		// 		this.lockVolume((error, result) => {
		// 			if (error) return this.error(error);					
		// 			resolve(true);
		// 		})
		// 	});
		// });


	}

}

module.exports = MyApp;