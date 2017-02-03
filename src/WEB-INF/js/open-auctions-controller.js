/**
/**
 * de.sb.broker.OpenAuctionsController: broker auctions controller.
 * Copyright (c) 2013-2015 Sascha Baumeister
 */
"use strict";

this.de = this.de || {};
this.de.sb = this.de.sb || {};
this.de.sb.broker = this.de.sb.broker || {};
(function () {
	var SUPER = de.sb.broker.Controller;
	var TIMESTAMP_OPTIONS = {
		year: 'numeric', month: 'numeric', day: 'numeric',
		hour: 'numeric', minute: 'numeric', second: 'numeric',
		hour12: false
	};


	/**
	 * Creates a new auctions controller that is derived from an abstract controller.
	 * @param sessionContext {de.sb.broker.SessionContext} a session context
	 */
	de.sb.broker.OpenAuctionsController = function (sessionContext) {
		SUPER.call(this, 1, sessionContext);
	};
	de.sb.broker.OpenAuctionsController.prototype = Object.create(SUPER.prototype);
	de.sb.broker.OpenAuctionsController.prototype.constructor = de.sb.broker.OpenAuctionsController;


	/**
	 * Displays the associated view.
	 */
	de.sb.broker.OpenAuctionsController.prototype.display = function () {
		if (!this.sessionContext.user) return;
		SUPER.prototype.display.call(this);

		var sectionElement = document.querySelector("#open-auctions-template").content.cloneNode(true).firstElementChild;
		sectionElement.querySelector("button").addEventListener("click", this.displayForm.bind(this));		
		document.querySelector("main").appendChild(sectionElement);
		
		sectionElement = document.querySelector("#auction-form-template").content.cloneNode(true).firstElementChild;
		document.querySelector("main").appendChild(sectionElement);		
		
		var indebtedSemaphore = new de.sb.util.Semaphore(1 - 2);
		var statusAccumulator = new de.sb.util.StatusAccumulator();
		var self = this;

		var resource = "/services/auctions?closed=false";
		de.sb.util.AJAX.invoke(resource, "GET", {"Accept": "application/json"}, null, this.sessionContext, function (request) {
			if (request.status === 200) {
				var auctions = JSON.parse(request.responseText);
				self.displayAuctions(auctions);
			}
			statusAccumulator.offer(request.status, request.statusText);
			indebtedSemaphore.release();
		});
		
		indebtedSemaphore.acquire(function () {
			self.displayStatus(statusAccumulator.status, statusAccumulator.statusText);
		});
	};

	/**
	 * Displays the given auctions that feature the requester as bidder.
	 * @param auctions {Array} the bidder auctions
	 */
	de.sb.broker.OpenAuctionsController.prototype.displayAuctions = function (auctions) {
		var tableBodyElement = document.querySelector("section.open-auctions tbody");
		var rowTemplate = document.createElement("tr");
		for (var index = 0; index < 7; ++index) {
			var cellElement = document.createElement("td");
			cellElement.appendChild(document.createElement("output"));
			rowTemplate.appendChild(cellElement);
		}

		var self = this;
		auctions.forEach(function (auction) {
			var rowElement = rowTemplate.cloneNode(true);
			tableBodyElement.appendChild(rowElement);

			var activeElements = rowElement.querySelectorAll("output");
			var img, id;
			if(auction){
				img = document.createElement('img');
				id = auction.seller.identity;
			    img.src = "/services/people/" + id + "/avatar?w=50&h=50";
			    activeElements[0].appendChild(img);
				activeElements[0].title = createDisplayTitle(auction.seller);
			}
			activeElements[1].value = new Date(auction.creationTimestamp).toLocaleString(TIMESTAMP_OPTIONS);
			activeElements[2].value = new Date(auction.closureTimestamp).toLocaleString(TIMESTAMP_OPTIONS);
			activeElements[3].value = auction.title;
			activeElements[3].title = auction.description;
			activeElements[4].value = auction.unitCount;
			activeElements[5].value = (auction.askingPrice * 0.01).toFixed(2);
			var editTemplate = document.querySelector("#edit-auctions-bid-template").content.cloneNode(true).firstElementChild;
			
			if(auction.seller.identity === self.sessionContext.user.identity) {
				if(!auction.sealed) {	
					var editButton = editTemplate.querySelector("#edit");
					editButton.addEventListener("click", self.displayForm.bind(self, auction));		
					activeElements[6].appendChild(editButton);		// EDIT YOUR OWN AUCTION 									
				} else {					
					activeElements[6].value = "SEALED";		
				}
			} else {
					var editField = editTemplate.querySelector("#bidEdit");	
					var editButton = editTemplate.querySelector("#edit"); // TODO change button title
					//editButton.addEventListener("click", self.displayForm.bind(this));	// INSTEAD PUT YOUR BID
					activeElements[6].appendChild(editField);		
					activeElements[6].appendChild(editButton);	
			}
		});
	};
	
	
	/**
	 * Display the auction edit-form
	 */
	de.sb.broker.OpenAuctionsController.prototype.displayForm = function (auction) {
		var formElement = document.querySelector("main").lastChild;
		formElement.className += " active";
		
		var inputElements = document.querySelectorAll("section.auction-form input");
		var auctionIdentity = 0;
		if(auction) {
			auctionIdentity = auction.identity;
			inputElements[0].value = new Date(auction.creationTimestamp).toLocaleString(TIMESTAMP_OPTIONS);
			inputElements[1].value = new Date(auction.closureTimestamp).toLocaleString(TIMESTAMP_OPTIONS);
			inputElements[2].value = auction.title;
			inputElements[3].value = auction.unitCount;
			inputElements[4].value = (auction.askingPrice * 0.01).toFixed(2);
			document.querySelector("section.auction-form textarea").value = auction.description;
		} else {			
			var startDate = new Date();
			inputElements[0].value = formatDate(startDate.getMonth()+1) + "/" + formatDate(startDate.getDate()) + "/" + (startDate.getFullYear()) + " " + formatDate(startDate.getHours()) + ":" + formatDate(startDate.getMinutes());
			var endDate = new Date((new Date()).getTime() + 30*24*60*60*1000);
			inputElements[1].value = formatDate(endDate.getMonth()+1) + "/" + formatDate(endDate.getDate()) + "/" + (endDate.getFullYear()) + " " + formatDate(endDate.getHours()) + ":" + formatDate(endDate.getMinutes());			
		}		
		formElement.querySelector("#submit").addEventListener("click", this.persistAuction.bind(this, auctionIdentity)); // TODO bind id to persist
		formElement.querySelector("#abort").addEventListener("click", function() {
			formElement.className = "auction-form";
		});
	};
	
	/**
	 * Persists a new auction.
	 */

	de.sb.broker.OpenAuctionsController.prototype.persistAuction = function (auctionIdentity) {
		var inputElements = document.querySelectorAll("section.auction-form input");
		var textAreaElement = document.querySelector("section.auction-form textarea");
		
		var auction = {};
		auction.identity = auctionIdentity;
		auction.closureTimestamp = toTimestamp(String(inputElements[1].value));
		auction.title = inputElements[2].value.trim();
		auction.description = textAreaElement.value.trim();
		auction.unitCount = inputElements[3].value;
		auction.askingPrice = inputElements[4].value.split('.').join('');

		var self = this;
		var header = {"Content-type": "application/json"};
		var body = JSON.stringify(auction);
		de.sb.util.AJAX.invoke("/services/auctions", "PUT", header, body, this.sessionContext, function (request) {
			self.displayStatus(request.status, request.statusText);
			if (request.status === 200) {
				self.display();
			} else if (request.status === 409) {
				de.sb.broker.APPLICATION.welcomeController.display(); 
			} 
		});
		
		document.querySelector("main").lastChild.className = "auction-form";
	};
	

	/**
	 * Returns the bid with the highest price offer.
	 * @param bids {Array} the bids
	 * @return the maximum bid, or null for none
	 */
	function selectBidByMaximumPrice (bids) {
		var maxBid = null;
		if(bids !== undefined) {
			bids.forEach(function (bid) {
				if (!maxBid || bid.price > maxBid.price) maxBid = bid;
			});
		}
		return maxBid;
	}


	/**
	 * Returns the bid featuring the given bidder.
	 * @param bids {Array} the bids
	 * @param bidderIdentity the bidder identity
	 * @return the bidder's bid, or null for none
	 */
	function selectBidByBidder (bids, bidderIdentity) {
		for(var index = 0; index < bids.length; ++index) {
			var bid = bids[index];
			if (bid.bidder.identity == bidderIdentity) return bid;
		}
		return null;
	}

	/**
	 * Creates a display title for the given person.
	 * @param person {Object} the person
	 */
	function createDisplayTitle (person) {
		if (!person) return "";
		if (!person.name) return person.alias;
		return person.name.given + " " + person.name.family + " (" + person.contact.email + ")";
	}
	
	/**
	 * Creates the price
	 */
	function createPrice(price) {
		return (Math.floor(cents/100)) + "." + (cents % 100);
	}
	
	/**
	 * Format the date for display
	 */
	function formatDate(value) {
		return (value.toString().length == 1) ? "0"+ value : value;
	}
	
	/**
	 * Convert date to timestamp for insertion
	 */
	function toTimestamp(date) {
		return Date.parse(date);
	}
} ());