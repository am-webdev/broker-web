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
		var tableBodyElement = document.querySelector("section.open-auctions-template tbody");
		var rowTemplate = document.createElement("tr");
		for (var index = 0; index < 9; ++index) {
			var cellElement = document.createElement("td");
			cellElement.appendChild(document.createElement("output"));
			rowTemplate.appendChild(cellElement);
		}

		var self = this;
		//TODO: fix! Uncaught TypeError: Cannot read property 'forEach' of undefined
		auctions.forEach(function (auction) {
			var rowElement = rowTemplate.cloneNode(true);
			tableBodyElement.appendChild(rowElement);

			var maxBid = selectBidByMaximumPrice(auction.bids);
			var userBid = selectBidByBidder(auction.bids, self.sessionContext.user.identity);
			var activeElements = rowElement.querySelectorAll("output");
			activeElements[0].value = auction.seller.alias;
			activeElements[0].title = createDisplayTitle(auction.seller);
			activeElements[1].value = maxBid.bidder.alias;
			activeElements[1].title = createDisplayTitle(maxBid.bidder);
			activeElements[2].value = new Date(auction.creationTimestamp).toLocaleString(TIMESTAMP_OPTIONS);
			activeElements[3].value = new Date(auction.closureTimestamp).toLocaleString(TIMESTAMP_OPTIONS);
			activeElements[4].value = auction.title;
			activeElements[4].title = auction.description;
			activeElements[5].value = auction.unitCount;
			activeElements[6].value = (auction.askingPrice * 0.01).toFixed(2);
			activeElements[7].value = (userBid.price * 0.01).toFixed(2);
			activeElements[8].value = (maxBid.price * 0.01).toFixed(2);
		});
	};
	
	
	/**
	 * Display the auction edit-form
	 */
	de.sb.broker.OpenAuctionsController.prototype.displayForm = function () {
		var formElement = document.querySelector("main").lastChild;
		formElement.className += " active";
		
		//TODO: Form for if an auction will be edit: 
		//@param aution
		//if(auction) exists and there's no bid -> set new Field values
		//persist Auction with new Values excluding Timestamp
		
		var inputElements = document.querySelectorAll("section.auction-form input");
		var startDate = new Date();
		inputElements[0].value = formatDate(startDate.getMonth()+1) + "/" + formatDate(startDate.getDate()) + "/" + (startDate.getFullYear()) + " " + formatDate(startDate.getHours()) + ":" + formatDate(startDate.getMinutes());
		var endDate = new Date((new Date()).getTime() + 30*24*60*60*1000);
		inputElements[1].value = formatDate(endDate.getMonth()+1) + "/" + formatDate(endDate.getDate()) + "/" + (endDate.getFullYear()) + " " + formatDate(endDate.getHours()) + ":" + formatDate(endDate.getMinutes());
		
		formElement.querySelector("#submit").addEventListener("click", this.persistAuction.bind(this));
		formElement.querySelector("#abort").addEventListener("click", function() {
			formElement.className = "auction-form";
		});
	}
	
	/**
	 * Persists a new auction.
	 */

	de.sb.broker.OpenAuctionsController.prototype.persistAuction = function () {
		var inputElements = document.querySelectorAll("section.auction-form input");
		var textAreaElement = document.querySelector("section.auction-form textarea");

		var auction = {};
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
				
				var resource = "/services/auctions?closed=false";
				de.sb.util.AJAX.invoke(resource, "GET", {"Accept": "application/json"}, null, self.sessionContext, function (request) {
					if (request.status === 200) {
						var auctions = JSON.parse(request.responseText);
						self.displayAuctions(auctions);
					}
				});
				
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
		bids.forEach(function (bid) {
			if (!maxBid || bid.price > maxBid.price) maxBid = bid;
		});
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