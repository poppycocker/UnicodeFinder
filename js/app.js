$(function() {

	var lastStateKey = 'lastState_UTF8Finder';

	var QueryProcessor = (function() {
		var p = function() {};
		p.prototype = {
			getCodePoints: function(str) {
				var tmp = str.toLowerCase().replace('u+', '').replace('0x', '').replace(/\s/g, ''),
					hex, i, ERR_CODE = -1,
					ar = [];

				// is Number or Unicode Codepoint ?
				if (tmp.match(/^([0-9]|[a-f])+$/)) {
					hex = +('0x' + tmp);
					ar.push(hex);
					ar.push(+tmp);
					ar.push(String.utf8Octet2Codepoint(hex));
					ar.push(String.utf8Octet2Codepoint(tmp));
				}
				// evaluate as UTF-8 String
				for (i = 0; i < str.length; i++) {
					ar.push(str.charCodeAt(i));
				}

				return ar.filter(function(v) {
					return (!isNaN(v) && v !== ERR_CODE && v <= 0x1fffff);
				}).uniq();
			}
		};
		return p;
	})();

	var AppView = Backbone.View.extend({
		el: '#wrapper',
		initialize: function() {
			var collection = new ResultCollection();
			this.resultView = new ResultView({
				collection: collection
			});
			this.searchView = new SearchView({
				collection: collection
			});
		},
	});

	var SearchView = Backbone.View.extend({
		el: '.search_box',
		events: {
			'keyup .input_query': 'onSearch',
			'click .icon-clear': 'clearField'
		},
		initialize: function() {
			_.bindAll(this, 'onSearch', 'setCodepoint', 'removeAll', 'clearField');
			this.queryProcessor = new QueryProcessor();
			// Ctrl+Q to focus on the input field.
			shortcut.add('Ctrl+Q', _.bind(function() {
				this.$input.focus().select();
			}, this), {
				'type': 'keydown',
				'propagate': true,
				'target': document
			});
			// load last state or show demo.
			var lastState = window.localStorageWrapper.data(lastStateKey) || {};
			this.$input = $('.input_query').val(lastState.query || 'U+3042').focus().select();
			this.onSearch();
			// save last state when the window is reloaded or closed.
			window.onbeforeunload = _.bind(function() {
				window.localStorageWrapper.data(lastStateKey, {
					query: this.$input.val()
				});
			}, this);
		},
		onSearch: function(e) {
			var key = this.$input.val();
			if (key === this.prev) {
				return;
			}
			this.prev = key;
			this.removeAll();
			this.queryProcessor.getCodePoints(key).forEach(_.bind(function(n) {
				this.setCodepoint(n);
			}, this));

			if (this.collection.length === 0) {
				this.collection.reset();
			}
		},
		setCodepoint: function(cp) {
			var octet = String.codepoint2UTF8Octet(cp);
			var model = new ResultUnitModel({
				codePoint: cp.toString(16).toUpperCase().zeroPadding(4),
				codePointDec: cp.toString(10),
				octet: octet.toString(16).toUpperCase().zeroPadding('even').devideBy(2, ' '),
				octetDec: octet.toString(10),
				character: String.fromCharCodeEx(cp),
				iso8859: String.getISO8859NFromUnicode(cp),
				name: String.getUnicodeName(cp)
			});
			this.collection.add(model);
		},
		removeAll: function() {
			_.invoke(this.collection.toArray(), 'destroy');
			this.collection.reset();
		},
		clearField: function() {
			this.$input.val('').focus();
			this.removeAll();
		}
	});

	var ResultView = Backbone.View.extend({
		el: '.results',
		initialize: function() {
			this.$sample = $('.sample');
			_.bindAll(this, 'render', 'showSample');
			this.collection.bind('add', this.render);
			this.collection.bind('reset', this.showSample);
		},
		render: function(model) {
			this.$sample.removeClass('showBlock');
			var view = new ResultUnitView({
				model: model
			});
			this.$el.append(view.render().$el);
			return this;
		},
		showSample: function() {
			this.$sample.addClass('showBlock');
		}
	});

	var ResultUnitView = Backbone.View.extend({
		tagName: 'li',
		initialize: function() {
			_.bindAll(this, 'render', 'remove');
			this.template = _.template($('#tmpl_result').html());
			this.model.bind('destroy', this.remove);
		},
		render: function() {
			this.$el.html(this.template(this.model.attributes)).addClass('clearfix');
			return this;
		}
	});
	var ResultUnitModel = Backbone.Model.extend({
		defaults: function() {
			return {
				codePoint: '',
				codePointDec: '',
				octet: '',
				octetDec: '',
				character: '',
				iso8859: '',
				name: ''
			};
		}
	});
	var ResultCollection = Backbone.Collection.extend({});

	window.app = new AppView();
});