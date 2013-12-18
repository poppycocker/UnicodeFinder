$(function() {

	var AppView = Backbone.View.extend({
		el: '#wrapper',
		initialize: function() {
			var collection = new ResultCollection();

			this.searchView = new SearchView({
				collection: collection
			});
			this.resultView = new ResultView({
				collection: collection
			});
		},
	});

	var SearchView = Backbone.View.extend({
		el: '.input_query',
		events: {
			'keyup': 'onSearch'
		},
		initialize: function() {
			_.bindAll(this, 'onSearch', 'setCP', 'clear');
		},
		onSearch: function(e) {
			var key = this.$el.val();
			if (key === this.prev) {
				return;
			}
			this.prev = key;
			this.clear();

			var tmp = key.toLowerCase().replace('u+', '').replace('0x', ''),
				hex, i = 0,
				ar = [];

			// is Number or Unicode Codepoint ?
			if (tmp.match(/^([0-9]|[a-f])+$/)) {
				hex = +('0x' + tmp);
				ar.push(+tmp); // ? -> dec
				ar.push(hex); // ? -> hex
				ar.push(String.octet2Codepoint(tmp));
				ar.push(String.octet2Codepoint(hex));
			}
			// evaluate as UTF-8 String
			for (; i < key.length; i++) {
				ar.push(key.charCodeAt(i));
			}

			ar.filter(function(v) {
				return (!isNaN(v) && v && v <= 0x1fffff);
			}).uniq().forEach(_.bind(function(n) {
				this.setCP(n);
			}, this));

		},
		setCP: function(cp) {
			var dec = String.codepoint2Octet(cp);
			this.collection.add(new ResultUnitModel({
				codePoint: 'U+' + cp.toString(16).toUpperCase().zeroPadding(4),
				cpDec: cp,
				hex: '0x' + dec.toString(16).toUpperCase().zeroPadding('even'),
				dec: dec,
				character: String.fromCharCodeEx(cp)
			}));
		},
		clear: function() {
			this.collection.clearAll();
		}
	});

	var ResultView = Backbone.View.extend({
		el: '.results',
		initialize: function() {
			_.bindAll(this, 'render');
			this.collection.bind('add', this.render);
		},
		render: function(model) {
			var view = new ResultUnitView({
				model: model
			});
			this.$el.append(view.render().$el);
			return this;
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
			this.$el.html(this.template(this.model.attributes));
			return this;
		}
	});
	var ResultUnitModel = Backbone.Model.extend({
		defaults: function() {
			return {
				codePoint: '',
				hex: '',
				dec: '',
				character: ''
			};
		}
	});
	var ResultCollection = Backbone.Collection.extend({
		clearAll: function() {
			var model;
			while (model = this.first()) {
				model.destroy();
			}
		}
	});

	window.app = new AppView();
});