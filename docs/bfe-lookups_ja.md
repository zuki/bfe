`bfe` Lookups
----------------

`bfe` lookupはオートコンプリート候補をフェッチし、表示形のフォーマットを行うロジックを持ち、候補の選択後に後処理を行い、エディタにデータを返すJavascriptファイルである。

どんなものかは例を見たほうが早いだろう。 

https://github.com/lcnetdev/bfe/blob/master/src/lookups/rdacarriers.js

**注意**: 上のファイルではちょっとした魔法を行うヘルパーファイルを呼んでいる。

各lookupファイルは3つのオブジェクトをエクスポートしなければならない。

* `scheme` - (文字列) schemeの識別子を表す文字列。プロファイルから適切な `useValuesFrom` 定義を選択する際に使用される。
* `source` - (関数) 2つのパラメタ `query, process` を持ち、`uri` プロパティと `value` プロパティ(表示用テキスト)を持つオブジェクトのリストを返す関数。
* `getResource` - (関数) 4つのパラメタ: `subjecturi, propertyuri, selected, process`. を持つ関数。`subjecturi` は記述対象のリソースのURI、`propertyuri` はlookupを呼び出したプロパティのプロパティuriである。`selected` は選択されたアイテムで、`uri`と`value`の2つのプロパティを持つ。これらのプロパティについては上の`souce`を参照のこと。`process`はコールバックであり、最後に[`bfestore`][bfestor]にしたがってフォーマットされたトリプルの配列をパラメタに呼び出される。
各トリプルに`guid`プロパティを含めることは必須ではない。データがエディタに返された後に追加されるからである。

Lookupは実行時に作成して動的にロードすることが可能である。[`bfe`の設定][configuring-bfe]を参照のこと。動的にロードされるlookupの'キー'が既存またはロード済みのlookupと同じ場合は、ロード済みのlookupは上書きされ、新たにロードされるlookupが使用される。

<!-- section links -->

[bfestore]: https://github.com/zuki/bfe/blob/master/docs/bfe-api.md#bfestore
[configuring-bfe]: https://github.com/zuki/bfe/blob/master/docs/bfe-api.md#configuring-bfe
