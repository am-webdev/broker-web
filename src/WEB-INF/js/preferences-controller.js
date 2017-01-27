/**
 * de.sb.broker.PreferencesController: broker preferences controller.
 * Copyright (c) 2013-2015 Sascha Baumeister
 */
"use strict";

this.de = this.de || {};
this.de.sb = this.de.sb || {};
this.de.sb.broker = this.de.sb.broker || {};
(function () {
	var SUPER = de.sb.broker.Controller;

	/**
	 * Creates a new preferences controller that is derived from an abstract controller.
	 * @param sessionContext {de.sb.broker.SessionContext} a session context
	 */
	de.sb.broker.PreferencesController = function (sessionContext) {
		SUPER.call(this, 3, sessionContext);
	};
	de.sb.broker.PreferencesController.prototype = Object.create(SUPER.prototype);
	de.sb.broker.PreferencesController.prototype.constructor = de.sb.broker.PreferencesController;
	
	/**
	 * Displays the associated view.
	 */
	de.sb.broker.PreferencesController.prototype.display = function () {
		if (!this.sessionContext.user) return;
		SUPER.prototype.display.call(this);
		this.displayStatus(200, "OK");
		
		var sectionElement = document.querySelector("#preferences-template").content.cloneNode(true).firstElementChild;
		sectionElement.querySelector("button").addEventListener("click", this.persistUser.bind(this));
		var self = this;
		//Drag & Drop Events
		var avatarElement = sectionElement.querySelector("#avatar-upload");
		avatarElement.addEventListener("dragover", function( event ) {
		    event.preventDefault();
		    event.dataTransfer.dropEffect = 'copy';
		}, false);
		avatarElement.addEventListener("drop", function( event ) {
			var array;
			event.preventDefault();
			var reader = new FileReader();
			reader.onload = function() {
				var arrayBuffer = this.result,
				array = new Uint8Array(arrayBuffer);
				self.uploadAvatar(array);	
			};
			reader.readAsArrayBuffer(event.dataTransfer.files[0]);
		}, false);
		
		//Load current image or if not exist the default one
		var img = document.createElement('img');
	    img.src = "/services/people/" + this.sessionContext.user.identity + "/avatar?w=50&h=50";
	    //only to test image display
	    //default avatar src need to be set then
	    sectionElement.querySelector('#avatar-container').appendChild(img);
	    
	    document.querySelector("main").appendChild(sectionElement);

		this.displayUser();
	};
	
	/**
	 * Displays the session user.
	 */
	de.sb.broker.PreferencesController.prototype.displayUser = function () {
		var user = this.sessionContext.user;
		var activeElements = document.querySelectorAll("section.preferences input");
		activeElements[0].value = user.group;
		activeElements[1].value = user.alias;
		activeElements[2].value = "";
		activeElements[3].value = user.name.given;
		activeElements[4].value = user.name.family;
		activeElements[5].value = user.address.street;
		activeElements[6].value = user.address.postCode;
		activeElements[7].value = user.address.city;
		activeElements[8].value = user.contact.email;
		activeElements[9].value = user.contact.phone;
	};
	
	/**
	 * Upload user avatar
	 */
	de.sb.broker.PreferencesController.prototype.uploadAvatar = function (array) {

		var user = JSON.parse(JSON.stringify(this.sessionContext.user));
		console.log("user: ", user);
		user.avatar = {type : "application/octet-stream", content : array};
		// user.avatar.type = "application/octet-stream";		
		// user.avatar.content = array;		
		var self = this;
		var resource = "/services/people/" + this.sessionContext.user.identity + "/avatar";
		var header = {"Content-type": "application/octet-stream"};
		// var body = JSON.stringify(array);
		de.sb.util.AJAX.invoke(resource, "PUT", header, array, this.sessionContext, function (request) {
			self.displayStatus(request.status, request.statusText);
			if (request.status === 200) {
				self.sessionContext.user.avatar = user.avatar;
			} else if (request.status === 409) {
				de.sb.broker.APPLICATION.welcomeController.display(); 
			} else {
				self.displayUser();
			}
		});
	};


	/**
	 * Persists the session user.
	 */
	de.sb.broker.PreferencesController.prototype.persistUser = function () {
		var inputElements = document.querySelectorAll("section.preferences input");

		var user = JSON.parse(JSON.stringify(this.sessionContext.user));
		var password = inputElements[2].value.trim();
		user.name.given = inputElements[3].value.trim();
		user.name.family = inputElements[4].value.trim();
		user.address.street = inputElements[5].value.trim();
		user.address.postCode = inputElements[6].value.trim();
		user.address.city = inputElements[7].value.trim();
		user.contact.email = inputElements[8].value.trim();
		user.contact.phone = inputElements[9].value.trim();

		var self = this;
		var header = {"Content-type": "application/json"};
		if (password) header["Set-password"] = password;
		var body = JSON.stringify(user);
		de.sb.util.AJAX.invoke("/services/people", "PUT", header, body, this.sessionContext, function (request) {
			self.displayStatus(request.status, request.statusText);
			if (request.status === 200) {
				self.sessionContext.user.version = self.sessionContext.user.version + 1;
				self.sessionContext.user.name = user.name;
				self.sessionContext.user.address = user.address;
				self.sessionContext.user.contact = user.contact;
				if (password.length !== 0) self.sessionContext.userPassword = password;
			} else if (request.status === 409) {
				de.sb.broker.APPLICATION.welcomeController.display(); 
			} else {
				self.displayUser();
			}
		});
	};
} ());