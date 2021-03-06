`bfe` Lookups
----------------

`bfe` lookupは、オートコンプリート候補のフェッチ、表示形のフォーマット、候補選択後の後処理をしてエディタにデータを返すロジックを含むJavascriptファイルである。

どんなものかは例を見たほうが早いだろう。 

https://github.com/lcnetdev/bfe/blob/master/src/lookups/rdacarriers.js

**注意**: 上のファイルではちょっとした魔法を行うヘルパーファイルを呼んでいる。

各lookupファイルは3つのオブジェクトをエクスポートしなければならない。

* `scheme` - (文字列) schemeの識別子を表す文字列。プロファイルから適切な `useValuesFrom` 定義を選択する際に使用される。
* `source` - (関数) 2つのパラメタ `query, process` を取り、`uri` プロパティと `value` プロパティ(表示用テキスト)を持つオブジェクトのリストを返す関数。
* `getResource` - (関数) 4つのパラメタ: `subjecturi, propertyuri, selected, process` を取る関数。`subjecturi` は記述対象のリソースのURI、`propertyuri` はlookupを呼び出したプロパティのプロパティuriである。`selected` は選択されたアイテムで、`uri`と`value`の2つのプロパティを持つ。これらのプロパティについては上の`souce`を参照のこと。`process`は最後に[`bfestore`][bfestor]にしたがってフォーマットされたトリプルの配列をパラメタに呼び出されるコールバック関数である。
各トリプルに`guid`プロパティを含めることは必須ではない。データがエディタに返された後に追加されるからである。

Lookupは実行時に作成して動的にロードすることが可能である。[`bfe`の設定][configuring-bfe]を参照のこと。動的にロードされるlookupの'キー'が既存またはロード済みのlookupと同じ場合は、ロード済みのlookupは上書きされ、新たにロードされるlookupが使用される。

<!-- section links -->

[bfestore]: https://github.com/zuki/bfe/blob/master/docs/bfe-api.md#bfestore
[configuring-bfe]: https://github.com/zuki/bfe/blob/master/docs/bfe-api.md#configuring-bfe
