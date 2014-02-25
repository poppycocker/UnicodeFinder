$(function() {

	var lastStateKey = 'lastState_UTF8Finder';

	var QueryProcessor = (function() {
		var p = function() {
			this.init();
		};
		p.prototype = {
			init: function(q) {
				this.uniqWords = [];
				this.charCodes = [];
				this.rawKey = q || '';
				this.cleansedKey = '';
			},
			set: function(q) {
				this.init(q);
				var tmp = q.toLowerCase().replace('u+', '').replace('0x', '').replace(/\s/g, ''),
					hex, i, ERR_CODE = -1,
					ar = [];
				this.cleansedKey = tmp;

				var isNumOrCode = (tmp.match(/^([0-9]|[a-f])+$/) !== null);

				// is Number or Unicode Codepoint ?
				if (isNumOrCode) {
					hex = +('0x' + tmp);
					ar.push(hex);
					ar.push(+tmp);
					ar.push(String.utf8Octet2Codepoint(hex));
					ar.push(String.utf8Octet2Codepoint(tmp));
				}

				Array.prototype.push.apply(ar, Array.prototype.map.call(q, function(ch) {
					return ch.charCodeAt();
				}));

				if (isNumOrCode) {
					if (tmp.length > 1) {
						this.uniqWords.push(tmp);
					}
				} else {
					this.uniqWords = Array.prototype.slice.call(q);
				}

				this.charCodes = ar.filter(function(v) {
					return (!isNaN(v) && v !== ERR_CODE && v <= 0x1fffff);
				}).uniq();
				return this;
			},
			getCodePoints: function() {
				return this.charCodes;
			},
			getUniqWords: function() {
				return this.uniqWords;
			}
		};
		return p;
	})();

	var mediator = _.extend({}, Backbone.Events);

	var AppView = Backbone.View.extend({
		el: '#wrapper',
		initialize: function() {
			_.bindAll(this, 'highlightString');
			mediator.on('highlight', this.highlightString);

			var collection = new ResultCollection();
			this.resultView = new ResultView({
				collection: collection
			});
			this.searchView = new SearchView({
				collection: collection
			});
			this.searchView.onSearch();
		},
		highlightString: function() {
			var upper = this.searchView.queryProcessor.cleansedKey.toUpperCase();
			if (upper.length > 0) {
				var keys = [upper, upper.zeroPadding('even').devideBy(2, ' ')];
				$('.unicode_info').highlight(keys);
			} else {
				$('.unicode_info').unhighlight();
			}
		}
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
			// save last state when the window is reloaded or closed.
			window.onbeforeunload = _.bind(function() {
				window.localStorageWrapper.data(lastStateKey, {
					query: this.$input.val()
				});
			}, this);
		},
		onSearch: function(e) {
			this.currentKey = this.$input.val();
			if (this.currentKey === this.prevKey) {
				return;
			}
			this.prevKey = this.currentKey;
			this.removeAll();
			this.queryProcessor.set(this.currentKey).getCodePoints().forEach(function(n) {
				this.setCodepoint(n);
			}, this);

			if (this.collection.length === 0) {
				this.collection.reset();
			}
		},
		setCodepoint: function(cp) {
			var octet8 = String.codePoint2UTF8Octet(cp);
			var octet16 = String.codePoint2UTF16Octet(cp);
			var model = new ResultUnitModel({
				codePoint: cp.toString(16).toUpperCase().zeroPadding(4),
				codePointDec: cp,
				octet8: octet8.toString(16).toUpperCase().zeroPadding('even').devideBy(2, ' '),
				octet8Dec: octet8,
				octet16: octet16.map(function(v) {
					return v.toString(16).toUpperCase().zeroPadding(4);
				}).reduce(function(prev, cur, idx, ar) {
					return prev + ' ' + cur;
				}),
				octet16Dec: octet16.reduce(function(prev, cur, idx, ar) {
					return prev + ' ' + cur;
				}),
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
			mediator.trigger('highlight');
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
			mediator.trigger('highlight');
			return this;
		}
	});
	var ResultUnitModel = Backbone.Model.extend({
		defaults: function() {
			return {
				codePoint: '',
				codePointDec: '',
				octet8: '',
				octet8Dec: '',
				octet16: '',
				octet16Dec: '',
				character: '',
				iso8859: '',
				name: ''
			};
		}
	});
	var ResultCollection = Backbone.Collection.extend({});

	window.app = new AppView();
});