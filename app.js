/*-----------------------------------------------------------------------------------------
[UCS-2 (UCS-4)]     [codepoint bit pattern]   [1st byte]  [2nd byte]  [3rd byte]  [4th byte]
U+ 0000..  U+007F    00000000-0xxxxxxx         0xxxxxxx
U+ 0080..  U+07FF    00000xxx-xxyyyyyy         110xxxxx    10yyyyyy
U+ 0800..  U+FFFF    xxxxyyyy-yyzzzzzz         1110xxxx    10yyyyyy    10zzzzzz    
U+10000..U+1FFFFF    00000000-000wwwxx         11110www    10xxxxxx    10yyyyyy    10zzzzzz
                    -xxxxyyyy-yyzzzzzz
------------------------------------------------------------------------------------------*/
// e.g.
// [in]  0xC6A9 ('Σ', U+01A9)
// [out] 0d0425 (=0x1A9)
function hex2UnicodeCP(hex) {
	var bytes, n, shift1st, codePoint;
	hex = +hex;
	// requires less than 4bytes
	bytes = Math.floor(Math.log(hex) / Math.log(0xFF) + 1);
	if (bytes > 4) {
		return -1;
	}
	// mask 1st byte
	shift1st = (bytes === 1) ? 0 : (bytes + 1);
	codePoint = (hex >> ((bytes - 1) * 8)) & (0xFF >> shift1st);
	for (n = 1; n < bytes; n++) {
		codePoint <<= 6;
		// 2nd-4th byte: mask 0x00111111
		codePoint += (hex >> ((bytes - 1 - n) * 8)) & 0x3F;
	}
	return codePoint;
}

function unicodeCP2Hex(cp) {
	var hex, bytes = 2;
	// 12345(dec) -> 12345(dec)
	// U+12345(hex) -> 74565(dec)
	if (typeof(cp) === 'string') {
		cp = +('0x' + cp.toLowerCase().replace('u+', ''));
	}
	if (cp > 0x1fffff) {
		return -1;
	}
	if (cp <= 0x007f) {
		return cp;
	}

	hex = ((cp & 0x3f) + 0x80);
	if (cp > 0x07ff) {
		hex += (((cp >> 6) & 0x3f) + 0x80) << 8;
		bytes++;
	}
	if (cp > 0xffff) {
		hex += (((cp >> 12) & 0x3f) + 0x80) << 16;
		bytes++;
	}
	hex += (((cp >> ((bytes - 1) * 6)) & (bytes === 4 ? 0x07 : 0x3f)) + ((0xf << (8 - bytes)) & 0xff)) << ((bytes - 1) * 8);

	return hex;
}

String.prototype.zeroPadding = function(length) {
	length = length || 0;
	var i = 0,
		zeros = '';
	for (; i < length - 1; i++) {
		zeros += '0';
	}
	return (zeros + this).slice(0 - length);
};
String.prototype.trim = function() {
	var i = 0,
		ret = '';
	for (; i < this.length; i++) {
		if (this[i] != '\t' && this[i] != '\n') {
			ret += this[i];
		}
	}
	return ret;
};

Array.prototype.uniq = function() {
	var o = {}, i = 0,
		l = this.length,
		r = [];
	for (; i < l; i++) {
		o[this[i]] = this[i];
	}
	for (i in o) {
		r.push(o[i]);
	}
	return r;
};

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
		initialize: function() {},
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

			// is HexNum or Unicode Codepoint ?
			if (tmp.match(/^([0-9]|[a-f])+$/)) {
				hex = +('0x' + tmp);
				ar.push(+tmp); // ? -> dec
				ar.push(hex); // ? -> hex
				ar.push(hex2UnicodeCP(tmp));
				ar.push(hex2UnicodeCP(hex));
			}
			// evaluate as UTF-8 String
			for (; i < key.length; i++) {
				ar.push(key.charCodeAt(i));
			}

			ar.filter(function(v) {
				return (!isNaN(v) && v);
			}).uniq().forEach(_.bind(function(n) {
				this.setCP(n);
			}, this));

		},
		setCP: function(cp) {
			this.collection.add(new ResultUnitModel({
				codePoint: 'U+' + cp.toString(16).toUpperCase().zeroPadding(4),
				hex: '0x' + unicodeCP2Hex(cp).toString(16).toUpperCase(),
				character: String.fromCharCode(cp)
			}));
		},
		clear: function() {
			var model;
			while (model = this.collection.first()) {
				model.destroy();
			}
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
				character: ''
			};
		}
	});
	var ResultCollection = Backbone.Collection.extend({});

	window.app = new AppView();
});