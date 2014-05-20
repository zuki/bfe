`bfe` API
----------------

`bfe` はJavascriptによるUIアプリケーションであり、定義されたプロファイルに基づいたHTMLフォームを作成する。`bfe` の設定と使用に関して以下に説明する。

内容
-----------------

* [`bfe`](#bfe)
* [`bfe` の設定](#configuring-bfe)
* [`bfestore`](#bfestore)
* [`bfelog`](#bfelog)


----------------

### `bfe`

ロードされる際の `bfe` の定義済みのJavascript名前空間である。

#### bfe.fulleditor(Object configObject, String divid) 

左側にナビゲーションメニューを持つ「フルエディタ」を呼び出す。`config`オブジェクトについては[以下](#configuring-bfe)を参照されたい。`id` はエディタを表示するHTML要素(`div`を使用する）の識別子である。

```javascript
var bfeditor = bfe.fulleditor(configObject, divid);
```


#### bfe.editor(Object configObject, String divid) 

`form` 要素のみの「エディタ」を呼び出す。左側のナビゲーションメニューは表示されない。`config`オブジェクトについては[以下](#configuring-bfe)を参照されたい。`id` はエディタを表示するHTML要素(`div`を使用する）の識別子である。

```javascript
var bfeditor = bfe.editor(configObject, divid);
```

----------------

### `bfe` の設定

`config` オブジェクトはJSONオブジェクトであり、ロードするプロファイルの指定は必須である。「フルエディタ」を呼び出す場合はナビゲーションメニューの構成も指定する。ユーザが `save` ボタンをクリックした際に呼び出されるコールバック関数を指定するために、通常 `return` 記述の指定も必要である。


#### (すべて詰め込んだ）例)

```javascript
{
    "baseURI": "http://example.org/",
    "profiles": [
        "static/profiles/bibframe/Agents.json",
        "static/profiles/bibframe/Annotations.json",
        "static/profiles/bibframe/Authorities.json",
        "static/profiles/bibframe/Entities.json",
        "static/profiles/bibframe/WIA.json",
    ],
    "startingPoints": [
        {
            "menuGroup": "BIBFRAME Generic",
            "menuItems": [
                {
                    label: "New HeldItem", 
                    useResourceTemplates: [ "profile:bf:HeldItem" ]
                },
                {
                    label: "New Instance", 
                    useResourceTemplates: [ "profile:bf:Instance" ]
                },
                {
                    label: "New Work", 
                    useResourceTemplates: [ "profile:bf:Work" ]
                },
                {
                    label: "New Work, Instance, & HeldItem", 
                    useResourceTemplates: [ "profile:bf:Work", "profile:bf:Instance", "profile:bf:HeldItem" ]
                },
            ]
        }
    ],
    "lookups": {
        "http://id.loc.gov/authorities/names": {
            "name": "LCNAF",
            "load": "src/lookups/lcnames"
        },
        "http://id.loc.gov/authorities/subjects": {
            "name": "LCSH",
            "load": "src/lookups/lcsubjects"
        }
    },
    "load": [
        {
            "templateID": "profile:bf:Work",
            "defaulturi": "http://id.loc.gov/resources/bibs/5226",
            "source": {
                "location": "http://id.loc.gov/resources/bibs/5226.bibframe_raw.jsonp",
                "requestType": "jsonp"
            }
        },
        {
            "templateID": "profile:bf:Instance",
            "defaulturi": "_:b105resourcesbibs5226"
        }
    ],
    "return": {
        "format": "jsonld-expanded",
        "callback": myCB
    }
}
```

#### `config` プロパティ

必須
* `profiles`: (配列) ロードすべきプロファイルの配置場所の配列。
* `return`: (オブジェクト) 2つのプロパティを持つオブジェクト。`format` はデータをフォーマットまたはシリアライズする方法を示す。現在のところ、 "jsonld-expanded" のみサポートされている。`callback` はコールバック関数の名前。このコールバック関数は `format` で指定した方法でフォーマットされたデータをパラメタに持つ。
* `startingPoints` (fulleditorのみ): (配列) 配列のメンバはメニューグループを構成するオブジェクトで、見出し(`menuGroup`)とアイテムの配列(`menuItems`)からなる。各アイテムは `label` とアイテムを表示する際に適用するリソーステンプレート(`useResourceTemplates`)を持つ。`useResourceTemplates` は（プロファイルの識別子ではなく）リソーステンプレートの識別値を持つ。2つ以上のリソーステンプレート識別子を指定した場合は合体されて1つの編集フォームとなる。各プロファイルについては[BIBFRAMEプロファイル仕様][profilespec]を参照されたい。

オプション
* `baseURI`: (文字列) 新たな識別子を作成する際に使用する基底URI。デフォルトは `http://example.org/`.
* `load`: (配列) エディタに自動的にロードするリソーステンプレートを指定する。"formのみ"エディタを使用する際には必須である。`load` オブジェクトの各メンバーは少なくともプロパティ `templateID` を指定する。`templateID` はロードするリソーステンプレートの識別子である。各リソーステンプレート（すなわち各オブジェクト）はリソースを表す。複数のオブジェクトが指定された場合は、メニューアイテムの `useResourceTemplates` に複数のリソーステンプレート識別子を指定した時のように（上の `startingPoints` プロパティを参照）合体されて1つの大きなフォームとして表示される。オブジェクトにはロード・編集されるリソースに使用される `defaultURI` を指定することもできる。既存のデータを"編集"するには `source` プロパティを使用する。`source` は編集のためにロードされるデータの `location` と `requestType` を示すオブジェクトである。`location` には完全URLを指定する（コンテンツネゴシエーションはサポートされていない）。`requestType` には `jsonp` か `json` を指定できる。`json` はクロスドメインリクエストを行わない場合に限り指定する。
* `logging`: (オブジェクト) 2つのプロパティを持つオブジェクト。`lebel` はロギングレベルを指定する。選択肢は INFO と DEBUG である。DEBUG は詳細ログを出力する。デフォルトは INFO である。`toConsole` はブール値で、"True" にすると実行時に出力がJavascriptコンソールに出力される。デフォルトは "True" である。
* `lookups`: (オブジェクト) オブジェクトのオブジェクト。オブジェクトのキーは使用する、またはプロファイルのリソーステンプレートの構成要素であるプロパティテンプレートのプロパティ `useValuesFrom` で使用することが要請されているスキームの識別子である。`useValuesFrom` プロパティについては[プロファイル仕様][profilespec]を参照されたい。各オブジェクトは2つのプロパティを持つ。`name` はlookupのラベル/識別子であり、typeahead ライブラリで使用される。`load` は typeahead ドロップダウン選択リストを作成し、選択したアイテムを処理するために必要な関数を含むJavascriptファイルの配置場所である。lookupの詳細に関しては[ここ][lookups-info]を参照されたい。  

<!-- section links -->

[profilespec]: http://bibframe.org/documentation/bibframe-profilespec/
[lookups-info]: https://github.com/zuki/bfe/blob/master/docs/bfe-lookups.md

----------------

### `bfestore`

`bfestore` は作成・変更されたデータを格納するインメモリストアである。編集のためにデータがロードされるとこのストアが作成される。編集作業でデータが作成、削除、変更されるたびにこのストアは更新される。`bfestore` はデータをアクセスする複数の方法を提供する。

#### bfe.bfestore.store

ストア自体である。ストアは次の形のトリプルの配列である。

```javascript
[
 {
  "guid": "79d84d4c-9752-fecd-9d79-91455a552dc5",
  "rtID": "profile:bf:Instance",
  "s": "http://example.org/79d84d4c-9752-fecd-9d79-91455a552dc5",
  "p": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  "o": "http://bibframe.org/vocab/Instance",
  "otype": "uri"
 },
 {
  "guid": "0dfcafb2-1a0c-e190-a372-7423675dd9c0",
  "s": "http://example.org/79d84d4c-9752-fecd-9d79-91455a552dc5",
  "p": "http://bibframe.org/vocab/title",
  "o": "Some title",
  "otype": "literal",
  "olang": "en"
 }
]
```

#### bfe.bfestore.storeDedup()

重複を削除したストアを返す。ストア中のトリプルの重複をクリアする。通常この関数を呼ぶ必要はない。以下のメソッドを呼ぶと内部で重複は削除されるからである。

#### bfe.bfestore.store2text()

ストアをテキストとして返す。これはストア中のデータを人間が読める形で簡単にアクセスするために用意された関数である。

#### bfe.bfestore.store2jsonldExpanded()

ストアをjsonld拡張構文のJSONオブジェクトとして返す。

----------------

### `bfelog`

`bfelog` は `bfe` のINFO / DEBUG ログ出力を管理する。ログ出力レベルの設定に関する詳細な情報は上の[`bfe` 設定オプション](#configuring-bfe)を参照されたい。`bfelog` は急いで作ったものなので再検討が必要な候補の1つである。

#### bfe.bfelog.getLog()

ログをJSONオブジェクトとして返す。以下がサンプルである。

```javascript
[
 {
  "dt": "2014-05-01T14:02:33.477Z",
  "dtLocaleSort": "2014-05-01T14:02:33.477Z",
  "dtLocaleReadable": "5/1/2014, 10:02:33 AM",
  "type": "INFO",
  "fileName": "src/bfelogging.js",
  "lineNumber": 23,
  "msg": "Logging instantiated: level is DEBUG; log to console is set to true"
 },
 {
  "dt": "2014-05-01T14:02:33.486Z",
  "dtLocaleSort": "2014-05-01T14:02:33.486Z",
  "dtLocaleReadable": "5/1/2014, 10:02:33 AM",
  "type": "INFO",
  "fileName": "src/bfelogging.js",
  "lineNumber": 24,
  "msg": "http://localhost:8000/"
 },
 {
  "dt": "2014-05-01T14:02:33.486Z",
  "dtLocaleSort": "2014-05-01T14:02:33.486Z",
  "dtLocaleReadable": "5/1/2014, 10:02:33 AM",
  "type": "INFO",
  "fileName": "src/bfe.js",
  "lineNumber": 126,
  "msg": "Loading profile: /static/profiles/bibframe/Agents.json"
 }
]
```


