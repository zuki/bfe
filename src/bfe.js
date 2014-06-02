define(function(require, exports, module) {
    require("src/lib/jquery-2.1.0.min");
    require("src/lib/json");
    require("src/lib/lodash.min"); // collection/object/array manipulation
    require("src/lib/bootstrap.min"); // modals
    require("src/lib/typeahead.jquery.min");
    // require("lib/rdf_store_min");

    var editorconfig = {};
    var bfestore = require("src/bfestore");
    var bfelog = require("src/bfelogging");
    //var store = new rdfstore.Store();
    var profiles = [];
    var resourceTemplates = [];
    var startingPoints = [];
    var formTemplates = [];
    //var lookups = [];

    var tabIndices = 1;

    var loadtemplates = [];
    var loadtemplatesANDlookupsCount = 0;
    var loadtemplatesANDlookupsCounter = 0;

    var lookupstore = [];
    var lookupcache = [];

    var editordiv;

    var forms = [];

    var lookups = {
        "http://id.loc.gov/authorities/names": {
            "name": "LCNAF",
            "load": require("src/lookups/lcnames")
        },
        "http://id.loc.gov/authorities/subjects": {
            "name": "LCSH",
            "load": require("src/lookups/lcsubjects")
        },
        "http://id.loc.gov/authorities/genreForms": {
            "name": "LCGFT",
            "load": require("src/lookups/lcgenreforms")
        },
        "http://id.loc.gov/resources/works": {
            "name": "LC-Works",
            "load": require("src/lookups/lcworks")
        },
        "http://id.loc.gov/resources/instances": {
            "name": "LC-Instances",
            "load": require("src/lookups/lcinstances")
        },
        "http://id.loc.gov/vocabulary/organizations": {
            "name": "Organizations",
            "load": require("src/lookups/lcorganizations")
        },
        "http://id.loc.gov/vocabulary/countries": {
            "name": "Countries",
            "load": require("src/lookups/lccountries")
        },
        "http://id.loc.gov/vocabulary/geographicAreas": {
            "name": "GeographicAreas",
            "load": require("src/lookups/lcgacs")
        },
        "http://id.loc.gov/vocabulary/languages": {
            "name": "Languages",
            "load": require("src/lookups/lclanguages")
        },
        "http://id.loc.gov/vocabulary/identifiers": {
            "name": "Identifiers",
            "load": require("src/lookups/lcidentifiers")
        },
        "http://id.loc.gov/vocabulary/targetAudiences": {
            "name": "Audiences",
            "load": require("src/lookups/lctargetaudiences")
        },
        "http://id.loc.gov/vocabulary/iso639-1": {
            "name": "ISO639-1",
            "load": require("src/lookups/iso6391")
        },
        "http://id.loc.gov/vocabulary/iso639-2": {
            "name": "ISO639-2",
            "load": require("src/lookups/iso6392")
        },
        "http://id.loc.gov/vocabulary/iso639-5": {
            "name": "ISO639-5",
            "load": require("src/lookups/iso6395")
        },
        "http://id.loc.gov/vocabulary/contentTypes": {
            "name": "RDA-Content-Types",
            "load": require("src/lookups/rdacontenttypes")
        },
        "http://id.loc.gov/vocabulary/mediaTypes": {
            "name": "RDA-Media-Types",
            "load": require("src/lookups/rdamediatypes")
        },
        "http://id.loc.gov/vocabulary/carriers": {
            "name": "RDA-Carriers",
            "load": require("src/lookups/rdacarriers")
        }
    };

    /*
    The following two bits of code come from the Ace Editor code base.
    Included here to make 'building' work correctly.  See:
    https://github.com/ajaxorg/ace/blob/master/lib/ace/ace.js
    */
    exports.aceconfig = require("src/lib/aceconfig");
    /**
    * Provides access to require in packed noconflict mode
    * @param {String} moduleName
    * @returns {Object}
    *
    **/
    exports.require = require;

    // 設定処理
    exports.setConfig = function(config) {

        editorconfig = config;

        // Set up logging
        bfelog.init(editorconfig);

        for (var i=0; i < config.profiles.length; i++) {
            file = config.profiles[i];
            bfelog.addMsg(new Error(), "INFO", "Loading profile: " + config.profiles[i]);
            $.ajax({
                type: "GET",
                dataType: "json",
                async: false,
                url: file,
                success: function(data) {
                    $("#bfeditor-loader").width($("#bfeditor-loader").width()+5+"%");
                    profiles.push(data);
                    for (var rt=0; rt < data.Profile.resourceTemplates.length; rt++) {
                        resourceTemplates.push(data.Profile.resourceTemplates[rt]);
                    }
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    bfelog.addMsg(new Error(), "ERROR", "FAILED to load profile: " + file);
                    bfelog.addMsg(new Error(), "ERROR", "Request status: " + textStatus + "; Error msg: " + errorThrown);
                }
            });
        }

        if (config.lookups !== undefined) {
            loadtemplatesANDlookupsCount = loadtemplatesANDlookupsCount + Object.keys(config.lookups).length;
            for (k in config.lookups) {
                var lu = config.lookups[k];
                bfelog.addMsg(new Error(), "INFO", "Loading lookup: " + lu.load);
                require([lu.load], function(r) {
                    setLookup(r);
                });
            }
        }
        if (editorconfig.baseURI === undefined) {
            editorconfig.baseURI = window.location.protocol + "//" + window.location.host + "/";
        }
        bfelog.addMsg(new Error(), "INFO", "baseURI is " + editorconfig.baseURI);

        if (config.load !== undefined) {
            loadtemplatesANDlookupsCount = loadtemplatesANDlookupsCount + config.load.length;
            config.load.forEach(function(l){
                var useguid = guid();
                var loadtemplate = {};
                var tempstore = [];
                loadtemplate.templateGUID = useguid;
                loadtemplate.resourceTemplateID = l.templateID;
                loadtemplate.resourceURI = l.defaulturi;
                loadtemplate.embedType = "page";
                loadtemplate.data = tempstore;
                loadtemplates.push(loadtemplate);
                if (l.source !== undefined && l.source.location !== undefined && l.source.requestType !== undefined) {
                    $.ajax({
                        url: l.source.location,
                        dataType: l.source.requestType,
                        success: function (data) {
                            bfelog.addMsg(new Error(), "INFO", "Fetched external source baseURI" + l.source.location);
                            bfelog.addMsg(new Error(), "DEBUG", "Source data", data);
                            /*
                                OK, so I would /like/ to just use rdfstore here
                                but it is treating literals identified using @value
                                within JSON objects as resources.  It gives them blank nodes.
                                This does not seem right and I don't have time to
                                investigate.
                                So, will parse the JSONLD myself, dagnabbit.
                                NOTE: it totally expects JSONLD expanded form.
                            */
                            tempstore = bfestore.jsonld2store(data);
                            tempstore.forEach(function(t){
                                if (t.p == "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" && t.otype == "uri" && t.s == l.defaulturi.replace('ml38281/', '')) {
                                    t.rtID = l.templateID;
                                }
                            });
                            loadtemplate.data = tempstore;
                            cbLoadTemplates();
                            /*
                            store.load('application/ld+json', data, function(success){
                                if (success) console.log("Loaded data for " + l.defaulturi);
                                var useguid = guid();
                                var loadtemplate = {};
                                var query = 'SELECT * WHERE { <' + l.defaulturi.replace('ml38281/', '') + '> ?p ?o}';
                                console.log("Query is " + query);
                                store.execute(query, function(success, results) {
                                    // process results
                                    if (success) {
                                        console.log(results);
                                        var tempstore = [];
                                        results.forEach(function(t){
                                            var tguid = guid();
                                            var triple = {};
                                            triple.guid = tguid;
                                            if (t.o.value == "http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
                                                triple.rtID = rt.id;
                                            }
                                            triple.s = l.defaulturi.replace('ml38281/', '');
                                            triple.p = t.p.value;
                                            triple.o = t.o.value;
                                            if (t.o.token == "uri") {
                                                triple.otype = "uri";
                                            } else if (t.o.token == "blank") {
                                                triple.otype = "uri";
                                            } else {
                                                triple.otype = "literal";
                                                triple.olang = "en";
                                            }
                                            //console.log(triple);
                                            tempstore.push(triple);
                                        });
                                        loadtemplate.id = useguid;
                                        loadtemplate.rtID = l.templateID;
                                        loadtemplate.defaulturi = l.defaulturi.replace('ml38281/', '');
                                        loadtemplate.data = tempstore;
                                        loadtemplates.push(loadtemplate);
                                        console.log("finished query store");
                                        cbLoadTemplates();
                                    }
                                });
                            });
                            */
                        },
                        error: function(XMLHttpRequest, textStatus, errorThrown) {
                            bfelog.addMsg(new Error(), "ERROR", "FAILED to load external source: " + l.source.location);
                            bfelog.addMsg(new Error(), "ERROR", "Request status: " + textStatus + "; Error msg: " + errorThrown);
                        }
                    });
                } else {
                    cbLoadTemplates();
                }
            });
        }

    }

    // メニュー付きエディターの作成
    exports.fulleditor = function (config, id) {

        editordiv = document.getElementById(id);

        var $menudiv = $('<div>', {id: "bfeditor-menudiv", class: "col-md-2 sidebar"});
        var $formdiv = $('<div>', {id: "bfeditor-formdiv", class: "col-md-10"});
        //var optiondiv = $('<div>', {id: "bfeditor-optiondiv", class: "col-md-2"});
        var $rowdiv = $('<div>', {class: "row"});

        var $loader = $('<div><br /><br /><h2>Loading...</h2><div class="progress progress-striped active">\
                        <div class="progress-bar progress-bar-info" id="bfeditor-loader" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100" style="width: 20%">\
                            <span class="sr-only">80% Complete</span>\
                        </div>\
                    </div>');

        $formdiv.append($loader);
        $rowdiv.append($menudiv);
        $rowdiv.append($formdiv);
        //rowdiv.append(optiondiv);

        $(editordiv).append($rowdiv);

        this.setConfig(config);

        for (var h=0; h < config.startingPoints.length; h++) {
            var sp = config.startingPoints[h];
            var $menuul = $('<ul>', {class: "nav nav-stacked"});
            var menuheadingul = null;
            if (typeof sp.menuGroup !== undefined && sp.menuGroup !== "") {
                $menuheading = $('<li><h5 style="font-weight: bold">' + sp.menuGroup + '</h5></li>');
                $menuheadingul = $('<ul class="nav"></ul>');
                $menuheading.append($menuheadingul);
                $menuul.append($menuheading);
            }
            for (var i=0; i < sp.menuItems.length; i++) {
                var $li = $('<li>');
                var $a = $('<a>', {href: "#", id: "sp-" + h + "_" + i});
                $a.html(sp.menuItems[i].label);
                $a.click(function(){
                    menuSelect(this.id);
                });
                $li.append($a);
                if ( $menuheadingul !== null ) {
                    $menuheadingul.append($li);
                } else {
                    $menuul.append($li);
                }
            }
            $menudiv.append($menuul);
        }

        // Debug div
        if (editorconfig.logging !== undefined && editorconfig.logging.level !== undefined && editorconfig.logging.level == "DEBUG") {
            var $debugdiv = $('<div>', {class: "col-md-12"});
            $debugdiv.html("Debug output");
            var $debugpre = $('<pre>', {id: "bfeditor-debug"});
            $debugdiv.append($debugpre);
            $(editordiv).append($debugdiv);
            $debugpre.html(JSON.stringify(profiles, undefined, " "));
        }

        var $footer = $('<div>', {class: "col-md-12"});
        $(editordiv).append($footer);

        if (loadtemplatesANDlookupsCount === 0) {
            // There was nothing to load, so we need to get rid of the loader.
            $formdiv.html("");
        }

        return {
            "profiles": profiles,
            "div": editordiv,
            "bfestore": bfestore,
            "bfelog": bfelog,
        };
    };

    // メニューなしエディタの作成
    exports.editor = function (config, id) {

        this.setConfig(config);

        editordiv = document.getElementById(id);

        var $formdiv = $('<div>', {id: "bfeditor-formdiv", class: "col-md-12"});

        //var optiondiv = $('<div>', {id: "bfeditor-optiondiv", class: "col-md-2"});

        var $rowdiv = $('<div>', {class: "row"});

        $rowdiv.append($formdiv);
        //rowdiv.append(optiondiv);

        $(editordiv).append($rowdiv);

        // Debug div
        if (editorconfig.logging !== undefined && editorconfig.logging.level !== undefined && editorconfig.logging.level == "DEBUG") {
            var $debugdiv = $('<div>', {class: "col-md-12"});
            $debugdiv.html("Debug output");
            var $debugpre = $('<pre>', {id: "bfeditor-debug"});
            $debugdiv.append($debugpre);
            $(editordiv).append($debugdiv);
            $debugpre.html(JSON.stringify(profiles, undefined, " "));
        }

        var $footer = $('<div>', {class: "col-md-12"});
        $(editordiv).append($footer);

        return {
            "profiles": profiles,
            "div": editordiv,
            "bfestore": bfestore,
            "bfelog": bfelog,
        };
    };

    // lookup関数の登録
    function setLookup(r) {
        if (r.scheme !== undefined) {
            bfelog.addMsg(new Error(), "INFO", "Setting up scheme " + r.scheme);
            var lu = config.lookups[r.scheme];
            lookups[r.scheme] = {};
            lookups[r.scheme].name = lu.name;
            lookups[r.scheme].load = r;
        } else {
            bfelog.addMsg(new Error(), "WARN", "Loading lookup FAILED", r);
        }
        cbLoadTemplates();
    }

    // 選択されたリソースの編集画面の作成
    function cbLoadTemplates() {
        $("#bfeditor-loader").width($("#bfeditor-loader").width()+5+"%");
        loadtemplatesANDlookupsCounter++;
        if (loadtemplatesANDlookupsCounter >= loadtemplatesANDlookupsCount) {
            $("#bfeditor-formdiv").html("");
            if (loadtemplates.length > 0) {
                bfelog.addMsg(new Error(), "DEBUG", "Loading selected template(s)", loadtemplates);
                var form = getForm(loadtemplates);
                $( ".typeahead", form.form ).each(function() {
                    setTypeahead(this);
                });
                var $exitButtonGroup = $('<div class="btn-group pull-right"> \
                    <button id="bfeditor-exitcancel" type="button" class="btn btn-default">Cancel</button> \
                    <!-- <button id="bfeditor-exitsaveasnew" type="button" class="btn btn-primary">Save as new</button> --> \
                    <button id="bfeditor-exitsave" type="button" class="btn btn-primary">Save</button> \
                </div>');
                form.form.append($exitButtonGroup);

                $("#bfeditor-exitcancel", form.form).click(function(){
                    cbLoadTemplates();
                });
                $("#bfeditor-exitcancel", form.form).attr("tabindex", tabIndices++);

                //$("#bfeditor-exitsaveasnew", form.form).click(function(){
                //    cbLoadTemplates();
                //});

                $("#bfeditor-exitsave", form.form).click(function(){
                    editorconfig.return.callback(bfestore.store2jsonldExpanded());
                });
                $("#bfeditor-exitsave", form.form).attr("tabindex", tabIndices++);

                $("#bfeditor-formdiv").html("");
                $("#bfeditor-formdiv").append(form.form);
                $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
                $("#bfeditor-debug").html(JSON.stringify(bfelog.getLog(), undefined, " "));
            }
        }
    }

    // 選択されたメニューの処理
    function menuSelect (spid) {
        //store = new rdfstore.Store();
        spnums = spid.replace('sp-', '').split("_");
        spoints = editorconfig.startingPoints[spnums[0]].menuItems[spnums[1]];

        bfestore.store = [];
        loadtemplatesCounter = 0;
        loadtemplatesCount = spoints.useResourceTemplates.length;
        loadtemplates = [];

        spoints.useResourceTemplates.forEach(function(l){
            var useguid = guid();
            var loadtemplate = {};
            var tempstore = [];
            loadtemplate.templateGUID = useguid;
            loadtemplate.resourceTemplateID = l;
            loadtemplate.resourceURI = editorconfig.baseURI + useguid;
            loadtemplate.embedType = "page";
            loadtemplate.data = tempstore;
            loadtemplates.push(loadtemplate);
            cbLoadTemplates();
        });
    }

    /*
    loadTemplates is an array of objects, each with this structure:
        {
            templateguid=guid,
            resourceTemplateID=resourceTemplateID,
            resourceuri="",
            embedType=modal|page
            data=bfestore
        }
    */
    // リソーステンプレートに基いてプロパティ入力フォームを作成
    function getForm (loadTemplates) {

        var rt;
        var property;

        // Create the form object.
        var fguid = guid();
        var fobject = {};
        fobject.id = fguid;
        fobject.store = [];
        fobject.resourceTemplates = [];
        fobject.resourceTemplateIDs = [];
        fobject.formTemplates = [];

        // Load up the requested templates, add seed data.
        for (var urt=0; urt < loadTemplates.length; urt++) {
            //console.log(loadTemplates[urt]);
            //useResourceTemplatesを元にsetConfig(confg)で設定したリソーステンプレートを抽出
            var rt = _.where(resourceTemplates, {"id": loadTemplates[urt].resourceTemplateID})
            if ( rt !== undefined && rt[0] !== undefined) {
                fobject.resourceTemplates[urt] = JSON.parse(JSON.stringify(rt[0]));
                //console.log(loadTemplates[urt].data);
                fobject.resourceTemplates[urt].data = loadTemplates[urt].data;
                fobject.resourceTemplates[urt].defaulturi = loadTemplates[urt].resourceURI;
                fobject.resourceTemplates[urt].useguid = loadTemplates[urt].templateGUID;
                fobject.resourceTemplates[urt].embedType = loadTemplates[urt].embedType;
                // We need to make sure this resourceTemplate has a defaulturi
                if (fobject.resourceTemplates[urt].defaulturi === undefined) {
                    fobject.resourceTemplates[urt].defaulturi = editorconfig.baseURI + loadTemplates[urt].templateGUID;
                }

                fobject.resourceTemplateIDs[urt] = rt[0].id;
            } else {
                bfelog.addMsg(new Error(), "WARN", "Unable to locate resourceTemplate. Verify the resourceTemplate ID is correct.");
            }
        }

        // フォームの作成（Let's create the form）
        var form = $('<form>', {id: "bfeditor-form-" + fobject.id, class: "form-horizontal", role: "form"});
        var forEachFirst = true;
        fobject.resourceTemplates.forEach(function(rt) {
            bfelog.addMsg(new Error(), "DEBUG", "Creating form for: " + rt.id, rt);
            var $resourcediv = $('<div>', {id: rt.useguid, "data-uri": rt.defaulturi}); // is data-uri used?
            var $resourcedivheading = $('<h3>' + rt.resourceLabel + '</h3>');
            $resourcediv.append($resourcedivheading);
            rt.propertyTemplates.forEach(function(property) {

                // 各プロパティはリソーステンプレートは別に一位に識別される必要がある
                // Each property needs to be uniquely identified, separate from
                // the resourceTemplate.
                var pguid = guid();
                property.guid = pguid;
                property.display = "true";

                var $formgroup = $('<div>', {class: "form-group"});
                var $label = $('<label for="' + property.guid + '" class="col-sm-3 control-label">' + property.propertyLabel + '</label>');
                var $saves = $('<div class="form-group"><div class="col-sm-3"></div><div class="col-sm-8"><div class="btn-toolbar" role="toolbar"></div></div></div>');

                //リテラルプロパティ（TODO: なぜ input type="email" ?）
                if (property.type == "literal") {

                    var $input = $('<div class="col-sm-8"><input type="email" class="form-control" id="' + property.guid + '" placeholder="' + property.propertyLabel + '" tabindex="' + tabIndices++ + '"></div>');

                    $button = $('<button type="button" class="btn btn-default" tabindex="' + tabIndices++ + '">Set</button>');
                    $button.click(function(){
                        setLiteral(fobject.id, rt.guid, property.guid);
                    });

                    $formgroup.append($label);
                    $formgroup.append($input);
                    $formgroup.append($button);
                    $formgroup.append($saves);
                }

                // リソースプロパティ
                if (property.type == "resource") {

                    if (_.has(property, "valueConstraint")) {
                        if (_.has(property.valueConstraint, "valueTemplateRefs")) {
                            /*
                            *  The below gives you a form like Z produced.   Keep for time being.
                            */
                            /*
                            button = $('<div class="btn-group"><button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></button></div>');
                            ul = $('<ul class="dropdown-menu" role="menu"></ul>');
                            vtRefs = property.valueConstraint.valueTemplateRefs;
                            for ( var v=0; v < vtRefs.length; v++) {
                                var vtrs = vtRefs[v];
                                valueTemplates = _.where(resourceTemplates, {"id": vtrs});
                                if (valueTemplates[0] !== undefined) {
                                    li = $('<li></li>');
                                    a = $('<a href="#">' + valueTemplates[0].resourceLabel + '</a>');
                                    $(a).click(function(){
                                        openModal(rt.guid, property.guid, valueTemplates[0]);
                                    });
                                    li.append(a);
                                    ul.append(li);
                                }
                            }
                            button.append(ul);
                            */

                            // 規定のリソースに入力が制限される場合
                            $buttondiv = $('<div class="col-sm-8" id="' + property.guid +'"></div>');
                            $buttongrp = $('<div class="btn-group btn-group-sm"></div>');
                            var vtRefs = property.valueConstraint.valueTemplateRefs;
                            for ( var v=0; v < vtRefs.length; v++) {
                                var vtrs = vtRefs[v];
                                var valueTemplates = _.where(resourceTemplates, {"id": vtrs});
                                if (valueTemplates[0] !== undefined) {
                                    var vt = valueTemplates[0];
                                    //console.log(vt);
                                    var $b = $('<button type="button" class="btn btn-default" tabindex="' + tabIndices++ + '">' + vt.resourceLabel + '</button>');

                                    var fid = fobject.id;
                                    var rtid = rt.guid;
                                    var pid = property.guid;
                                    var newResourceURI = editorconfig.baseURI + guid();
                                    // 選択したリソースの設定画面を開く
                                    $b.click({fobjectid: fid, newResourceURI: newResourceURI, propertyguid: pid, template: vt}, function(event){
                                        //console.log(event.data.template);
                                        openModal(event.data.fobjectid, event.data.template, event.data.newResourceURI, event.data.propertyguid, []);
                                    });
                                    $buttongrp.append($b);
                                }
                            }
                            $buttondiv.append($buttongrp);

                            $formgroup.append($label);
                            $formgroup.append($buttondiv);
                            $formgroup.append($saves);
                        } else if (_.has(property.valueConstraint, "useValuesFrom")) {
                            // useValuesFromの場合

                            // リソース入力画面でなく、かつプロパティラベルが "Lookup"、かつ先頭プロパティの場合は処理しない
                            // WIAの最初の入力画面が相当する
                            // Let's supress the lookup unless it is in a modal for now.
                            if (rt.embedType != "modal" && forEachFirst && property.propertyLabel.match(/lookup/i)) {
                                forEachFirst = false;
                                return;
                            }

                            // 最初の入力画面で規定のリソースに入力が制限され、入力するリソースを
                            // 選択した場合に現れるモーダル画面を作成

                            // (1) Lookup フィールドの作成
                            var $inputdiv = $('<div class="col-sm-8"></div>');
                            var $input = $('<input type="text" class="typeahead form-control" data-propertyguid="' + property.guid + '" id="' + property.guid + '" placeholder="' + property.propertyLabel + '" tabindex="' + tabIndices++ + '">');

                            $inputdiv.append($input);

                            $formgroup.append($label);
                            $formgroup.append($inputdiv);
                            //formgroup.append(button);
                            $formgroup.append($saves);


                            /*
                            // If the first conditional is active, is this even necessary?
                            if (rt.embedType == "modal" && forEachFirst && property.propertyLabel.match(/lookup/i)) {
                                // This is the first propertty *and* it is a look up.
                                // Let's treat it special-like.
                                var $saveLookup = $('<div class="modal-header" style="text-align: right;"><button type="button" class="btn btn-primary" id="bfeditor-modalSaveLookup-' + fobject.id + '" tabindex="' + tabIndices++ + '">Save changes</button></div>');
                                var $spacer = $('<div class="modal-header" style="text-align: center;"><h2>OR</h2></div>');
                                $formgroup.append($saveLookup);
                                $formgroup.append($spacer);
                            } else {
                                // let's suppress it
                                $input.prop("disabled", true);
                            }
                            */

                            // (2) 「Save changes」ボタンの作成
                            if (rt.embedType == "modal" && forEachFirst && property.propertyLabel.match(/lookup/i)) {
                                // This is the first propertty *and* it is a look up.
                                // Let's treat it special-like.
                                var $saveLookup = $('<div class="modal-header" style="text-align: right;"><button type="button" class="btn btn-primary" id="bfeditor-modalSaveLookup-' + fobject.id + '" tabindex="' + tabIndices++ + '">Save changes</button></div>');
                                var $spacer = $('<div class="modal-header" style="text-align: center;"><h2>OR</h2></div>');
                                $formgroup.append($saveLookup);
                                $formgroup.append($spacer);
                            }


                        } else {
                            // ここでは該当なし
                            // Type is resource, so should be a URI, but there is
                            // no "value template reference" or "use values from vocabularies"
                            // reference for it so just create label field
                            var $input = $('<div class="col-sm-8"><input class="form-control" id="' + property.guid + '" placeholder="' + property.propertyLabel + '" tabindex="' + tabIndices++ + '"></div>');

                            $button = $('<button type="button" class="btn btn-default" tabindex="' + tabIndices++ + '">Set</button>');
                            $button.click(function(){
                                setResourceFromLabel(fobject.id, rt.guid, property.guid);
                            });

                            $formgroup.append($label);
                            $formgroup.append($input);
                            $formgroup.append($button);
                            $formgroup.append($saves);

                        }
                    } else {
                        // ここでは該当なし
                        // Type is resource, so should be a URI, but there is
                        // no constraint for it so just create a label field.
                        var $input = $('<div class="col-sm-8"><input class="form-control" id="' + property.guid + '" placeholder="' + property.propertyLabel + '" tabindex="' + tabIndices++ + '"></div>');

                        $button = $('<button type="button" class="btn btn-default" tabindex="' + tabIndices++ + '">Set</button>');
                            $button.click(function(){
                                setResourceFromLabel(fobject.id, rt.guid, property.guid);
                        });

                        $formgroup.append($label);
                        $formgroup.append($input);
                        $formgroup.append($button);
                        $formgroup.append($saves);
                    }
                }

                $resourcediv.append($formgroup);
                forEachFirst = false;
            });
            form.append($resourcediv);
        });


        // OK now we need to populate the form with data, if appropriate.
        fobject.resourceTemplates.forEach(function(rt) {
            if (rt.data.length === 0) {
                // Assume a fresh form, no pre-loaded data.
                var id = guid();
                var uri = editorconfig.baseURI + rt.useguid;
                if (rt.defaulturi !== undefined && rt.defaulturi !== "") {
                    uri = rt.defaulturi;
                }
                var triple = {}
                triple.guid = rt.useguid;
                triple.rtID = rt.id;
                triple.s = uri;
                triple.p = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
                triple.o = rt.resourceURI;
                triple.otype = "uri";
                fobject.store.push(triple);
                bfestore.store.push(triple);
                rt.guid = rt.useguid;

                rt.propertyTemplates.forEach(function(property) {
                    if (_.has(property, "valueConstraint")) {
                        if (_.has(property.valueConstraint, "valueTemplateRefs")) {
                            var vtRefs = property.valueConstraint.valueTemplateRefs;
                            for ( var v=0; v < vtRefs.length; v++) {
                                var vtrs = vtRefs[v];
                                //console.log(rt.resourceURI);
                                //console.log(property.propertyURI);
                                //console.log(vtrs);
                                /*
                                    The following will be true, for example, when two
                                    profiles are to be rendered in one form.  Say that
                                    this "property" is "instanceOf" and this "rt" is
                                    an Instance (e.g. "rt:Instance:ElectronicBook").
                                    Also a Work (e.g. "rt:Work:EricBook") is to be displayed.
                                    This litle piece of code associates the Instance
                                    with the Work in the store.
                                    Question: if the store is pre-loaded with data,
                                    how do we dedup at this time?
                                */
                                if ( fobject.resourceTemplateIDs.indexOf(vtrs) > -1 && vtrs != rt.id ) {
                                    var relatedTemplates = _.where(bfestore.store, {rtID: vtrs});
                                    triple = {}
                                    triple.guid = guid();
                                    triple.s = uri;
                                    triple.p = property.propertyURI;
                                    triple.o = relatedTemplates[0].s;
                                    triple.otype = "uri";
                                    fobject.store.push(triple);
                                    bfestore.store.push(triple);
                                    property.display = "false";
                                }
                            }
                        }
                    }
                });
            } else {
                // This will likely be insufficient - we'll need the entire
                // pre-loaded store in this 'first' form.
                rt.data.forEach(function(t) {
                    var triple = {}
                    triple = t;
                    if ( triple.guid === undefined ) {
                        triple.guid = guid();
                    }
                    fobject.store.push(triple);
                });
            }

            // Populate form with pre-loaded data.
            bfelog.addMsg(new Error(), "DEBUG", "Populating form with pre-loaded data, if any");
            rt.propertyTemplates.forEach(function(property) {
                var propsdata = _.where(bfestore.store, {"s": rt.defaulturi, "p": property.propertyURI});
                if (propsdata[0] !== undefined) {
                    // If this property exists for this resource in the pre-loaded data
                    // then we need to make it appear.
                    bfelog.addMsg(new Error(), "DEBUG", "Found pre-loaded data for " + property.propertyURI);
                    propsdata.forEach(function(pd) {
                        var $formgroup = $("#" + property.guid, form).closest(".form-group");
                        var $save = $formgroup.find(".btn-toolbar").eq(0);
                        //console.log(formgroup);
                        var displaydata = "";
                        var triples = [];
                        //console.log("pd.otype is " + pd.otype);
                        if (pd.otype == "uri") {
                            var triples = _.where(bfestore.store, {"s": pd.o});
                            displaydata = pd.o;
                            //console.log("displaydata is " + displaydata);
                            var rtype = "";
                            if (triples.length > 0) {
                                triples.forEach(function(t) {
                                    if ( rtype == "" && t.p == "http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
                                        rtype = t.o;
                                    }
                                    // if "type" matches a resourceTemplate.resourceURI && one of the property.valueConstraint.templates equals that resource template id....
                                    var triplesResourceTemplateID = "";
                                    if ( rtype != "" ) {
                                        if (_.has(property, "valueConstraint")) {
                                            if (_.has(property.valueConstraint, "valueTemplateRefs")) {
                                                var resourceTs = _.where(resourceTemplates, {"resourceURI": rtype });
                                                //console.log("Found resourcetemplates for " + rtype);
                                                //console.log(resourceTs);
                                                resourceTs.forEach(function(r) {
                                                    //console.log("Looking for a match with " + r.id);
                                                    if (triplesResourceTemplateID == "" && _.indexOf(property.valueConstraint.valueTemplateRefs, r.id) !== -1) {
                                                        bfelog.addMsg(new Error(), "DEBUG", "Assocating one resource with another from loaded templates");
                                                        //console.log("Found a match in");
                                                        //console.log(property.valueConstraint.valueTemplateRefs);
                                                        //console.log("Associating " + r.id);
                                                        triplesResourceTemplateID = r.id;
                                                        t.rtID = r.id;
                                                    }
                                                });
                                            }
                                        }
                                    }
                                    fobject.store.push(t);
                                    if (t.p.match(/label/i)) {
                                        displaydata = t.o;
                                    }
                                });
                            }
                        } else {
                            displaydata = pd.o;
                        }
                        if (displaydata == "") {
                            displaydata = pd.s;
                        }
                        triples.push(pd);
                        var bgvars = {
                            "tguid": pd.guid,
                            "tlabelhover": displaydata,
                            "tlabel": displaydata,
                            "fobjectid": fobject.id,
                            "inputid": property.guid,
                            "triples": triples
                        };
                        var $buttongroup = editDeleteButtonGroup(bgvars);

                        $save.append($buttongroup);
                        if (property.valueConstraint !== undefined && property.valueConstraint.repeatable !== undefined && property.valueConstraint.repeatable == "false") {
                            var $el = $("#" + property.guid, form);
                            if ($el.is("input")) {
                                $el.prop("disabled", true);
                            } else {
                                //console.log(property.propertyLabel);
                                var $buttons = $("div.btn-group", $el).find("button");
                                $buttons.each(function() {
                                    $( this ).prop("disabled", true);
                                });
                            }
                        }
                    });

                } else if (_.has(property, "valueConstraint")) {
                    // Otherwise - if the property is not found in the pre-loaded data
                    // then do we have a default value?
                    if (_.has(property.valueConstraint, "defaultURI")) {
                        bfelog.addMsg(new Error(), "DEBUG", "Setting default data for " + property.propertyURI);
                        var data = property.valueConstraint.defaultURI;
                        // set the triple
                        var triple = {}
                        triple.guid = guid();
                        if (rt.defaulturi !== undefined && rt.defaulturi !== "") {
                            triple.s = rt.defaulturi;
                        } else {
                            triple.s = editorconfig.baseURI + rt.guid;
                        }
                        triple.p = property.propertyURI;
                        triple.o = data;
                        triple.otype = "uri";
                        fobject.store.push(triple);
                        bfestore.store.push(triple);

                        // set the form
                        var $formgroup = $("#" + property.guid, form).closest(".form-group");
                        var $save = $formgroup.find(".btn-toolbar").eq(0);

                        var display = "";
                        if (_.has(property.valueConstraint, "defaultLiteral")) {
                            display = property.valueConstraint.defaultLiteral;
                        }
                        displaydata = display;
                        var editable = true;
                        if (property.valueConstraint.editable !== undefined && property.valueConstraint.editable === "false") {
                            editable = false;
                        }
                        var bgvars = {
                            "tguid": triple.guid ,
                            "tlabelhover": displaydata,
                            "tlabel": displaydata,
                            "fobjectid": fobject.id,
                            "inputid": property.guid,
                            "editable": editable,
                            "triples": [triple]
                        };
                        var $buttongroup = editDeleteButtonGroup(bgvars);
                        $save.append($buttongroup);

                        if (property.valueConstraint.repeatable !== undefined && property.valueConstraint.repeatable == "false") {
                            var $el = $("#" + property.guid, form);
                            if ($el.is("input")) {
                                $el.prop("disabled", true);
                            } else {
                                //console.log(property.propertyLabel);
                                var $buttons = $("div.btn-group", $el).find("button");
                                $buttons.each(function() {
                                    $( this ).prop("disabled", true);
                                });
                            }
                        }

                    }
                }
            });
        });

        forms.push(fobject);
        bfelog.addMsg(new Error(), "DEBUG", "Newly created formobject.", fobject);
        return { formobject: fobject, form: form };
    }

    // callingformobjectid is as described
    // loadtemplate is the template objet to load.
    // resourceURI is the resourceURI to assign or to edit
    // inputID is the ID of hte DOM element within the loadtemplate form
    // triples is the base data.
    // Lookup機能付きのリソース入力用モーダルダイアログを作成
    function openModal(callingformobjectid, loadtemplate, resourceURI, inputID, triples) {

        // Modals
        var modal = '<div class="modal fade" id="bfeditor-modal-modalID" tabindex="' + tabIndices++ + '" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true"> \
            <div class="modal-dialog"> \
                <div class="modal-content"> \
                    <div class="modal-header"> \
                        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button> \
                        <h4 class="modal-title" id="bfeditor-modaltitle-modalID">Modal title</h4> \
                    </div> \
                    <div class="modal-body" id="bfeditor-modalbody-modalID"></div> \
                    <div class="modal-footer"> \
                        <button type="button" class="btn btn-default" id="bfeditor-modalCancel-modalID" data-dismiss="modal">Close</button> \
                        <button type="button" class="btn btn-primary" id="bfeditor-modalSave-modalID">Save changes</button> \
                    </div> \
                </div> \
            </div> \
        </div> '

        bfelog.addMsg(new Error(), "DEBUG", "Opening modal for resourceURI " + resourceURI);
        bfelog.addMsg(new Error(), "DEBUG", "inputID of DOM element / property when opening modal: " + inputID);
        bfelog.addMsg(new Error(), "DEBUG", "callingformobjectid when opening modal: " + callingformobjectid);

        var useguid = guid();
        var triplespassed = [];
        if (triples.length === 0) {
            // This is a fresh Modal, so we need to seed the data.
            // This happens when one is *not* editing data; it is fresh.
            var callingformobject = _.where(forms, {"id": callingformobjectid});
            callingformobject = callingformobject[0];
            callingformobject.resourceTemplates.forEach(function(t) {
                var properties = _.where(t.propertyTemplates, {"guid": inputID})
                if ( properties[0] !== undefined ) {
                    var triplepassed = {};
                    triplepassed.s = t.defaulturi;
                    triplepassed.p = properties[0].propertyURI; //instanceOF
                    triplepassed.o = resourceURI;
                    triplepassed.otype = "uri";
                    triplespassed.push(triplepassed);

                    triplepassed = {};
                    triplepassed.s = resourceURI;
                    triplepassed.rtID = loadtemplate.id;
                    triplepassed.p = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"; //rdf:type
                    triplepassed.o = loadtemplate.resourceURI;
                    triplepassed.otype = "uri";
                    triplespassed.push(triplepassed);
                }
            });
        } else {
            // Just pass the triples on....
            triplespassed = triples;
        }
        bfelog.addMsg(new Error(), "DEBUG", "triplespassed within modal", triplespassed);
        // モーダル画面の検索部分（"OR"までを作成）
        var form = getForm([{
            templateGUID: useguid,
            resourceTemplateID: loadtemplate.id,
            resourceURI: resourceURI,
            embedType: "modal",
            data: triplespassed
        }]);

        var m = modal.replace(/modalID/g, form.formobject.id);
        m = $(m);
        $(editordiv).append(m);

        $('#bfeditor-modalbody-' + form.formobject.id).append(form.form);
        $('#bfeditor-modaltitle-' + form.formobject.id).html(loadtemplate.resourceLabel);

        $('#bfeditor-modal-' + form.formobject.id).modal('show');
        $('#bfeditor-modalCancel-' + form.formobject.id).attr("tabindex", tabIndices++);

        $('#bfeditor-modalSave-' + form.formobject.id).click(function(){
            triples.forEach(function(triple) {
                removeTriple(callingformobjectid, inputID, triple);
            });
            setResourceFromModal(callingformobjectid, form.formobject.id, resourceURI, inputID, form.formobject.store);
        });
        $('#bfeditor-modalSave-' + form.formobject.id).attr("tabindex", tabIndices++);
        $('#bfeditor-modalSaveLookup-' + form.formobject.id).click(function(){
            triples.forEach(function(triple) {
                removeTriple(callingformobjectid, inputID, triple);
            });
            setResourceFromModal(callingformobjectid, form.formobject.id, resourceURI, inputID, form.formobject.store);
        });
        $('#bfeditor-modal-' + form.formobject.id).on("hide.bs.modal", function(e) {
            $(this).empty();
        });

        $( ".typeahead", form.form ).each(function() {
            setTypeahead(this);
        });

        $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
    }

    // モーダルダイアログで入力されたデータを元のリソースに保存
    function setResourceFromModal(formobjectID, modalformid, resourceID, propertyguid, data) {
        /*
        console.log("Setting resource from modal");
        console.log("guid of has oether edition: " + forms[0].resourceTemplates[0].propertyTemplates[13].guid);
        console.log("formobjectID is: " + formobjectID);
        console.log("modal form id is: " + modalformid);
        console.log("propertyguid is: " + propertyguid);
        console.log(forms);
        console.log(callingformobject);
        console.log(data);
        */
        bfelog.addMsg(new Error(), "DEBUG", "Setting resource from modal");
        bfelog.addMsg(new Error(), "DEBUG", "modal form id is: " + modalformid);
        var callingformobject = _.where(forms, {"id": formobjectID});
        callingformobject = callingformobject[0];
        callingformobject.resourceTemplates.forEach(function(t) {
            var properties = _.where(t.propertyTemplates, {"guid": propertyguid})
            if ( properties[0] !== undefined ) {

                bfelog.addMsg(new Error(), "DEBUG", "Data from modal: ", data);
                data.forEach(function(t) {
                    callingformobject.store.push(t);
                    bfestore.store.push(t);
                });

                bfestore.storeDedup();

                var $formgroup = $("#" + propertyguid, callingformobject.form).closest(".form-group");
                var save = $formgroup.find(".btn-toolbar")[0];
                //console.log(formgroup);

                bfelog.addMsg(new Error(), "DEBUG", "Selected property from calling form: " + properties[0].propertyURI);
                tlabel = _.find(data, function(t){ if (t.p.match(/label|authorizedAccess|title/i)) return t.o; });
                displaydata = data[0].s;
                if ( tlabel !== undefined) {
                    displaydata = tlabel.o;
                }

                var connector = _.where(data, {"p": properties[0].propertyURI})
                var bgvars = {
                        "tguid": connector[0].guid,
                        "tlabelhover": displaydata,
                        "tlabel": displaydata,
                        "fobjectid": formobjectID,
                        "inputid": propertyguid,
                        "triples": data
                    };
                var $buttongroup = editDeleteButtonGroup(bgvars);

                $(save).append($buttongroup);
                //$("#" + propertyguid, callingformobject.form).val("");
                if (properties[0].repeatable !== undefined && properties[0].repeatable == "false") {
                    $("#" + propertyguid, callingformobject.form).attr("disabled", true);
                }

            }
        });
        // Remove the form?
        //forms = _.without(forms, _.findWhere(forms, {"id": formobjectID}));
        $('#bfeditor-modalSave-' + modalformid).off('click');
        $('#bfeditor-modal-' + modalformid).modal('hide');

        $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
    }

    // 入力済みのデータの表示（修正・削除ボタン付き）
    function editDeleteButtonGroup(bgvars) {
        /*
            vars should be an object, structured thusly:
            {
                "tguid": triple.guid,
                "tlabel": tlabel | data
                "fobjectid": formobject.id
                "inputid": inputid,
                triples: []
            }
        */

        var $buttongroup = $('<div>', {id: bgvars.tguid, class: "btn-group btn-group-xs"});

        if (bgvars.tlabel.length > 15) {
            display = bgvars.tlabel.substr(0,15) + "...";
        } else {
            display = bgvars.tlabel;
        }
        var $displaybutton = $('<button type="button" class="btn btn-default" title="' + bgvars.tlabelhover + '">' + display +'</button>');
        $buttongroup.append($displaybutton);

        if ( bgvars.editable === undefined || bgvars.editable === true ) {
            var $editbutton = $('<button type="button" class="btn btn-warning">e</button>');
            $editbutton.click(function(){
                if (bgvars.triples.length === 1) {
                    editTriple(bgvars.fobjectid, bgvars.inputid, bgvars.triples[0]);
                } else {
                    editTriples(bgvars.fobjectid, bgvars.inputid, bgvars.triples);
                }
            });
            $buttongroup.append($editbutton);

            var $delbutton = $('<button type="button" class="btn btn-danger">x</button>');
            $delbutton.click(function(){
                if (bgvars.triples.length === 1) {
                    removeTriple(bgvars.fobjectid, bgvars.inputid, bgvars.triples[0]);
                } else {
                    removeTriples(bgvars.fobjectid, bgvars.inputid, bgvars.triples);
                }
            });
            $buttongroup.append($delbutton);
        }

        return $buttongroup;
    }

    // リテラルフィールドで入力されたデータを保存
    function setLiteral(formobjectID, resourceID, inputID) {
        var formobject = _.where(forms, {"id": formobjectID});
        formobject = formobject[0];
        //console.log(inputID);
        var data = $("#" + inputID, formobject.form).val();
        if (data !== undefined && data !== "") {
            var triple = {}
            triple.guid = guid();
            formobject.resourceTemplates.forEach(function(t) {
                var properties = _.where(t.propertyTemplates, {"guid": inputID})
                if ( properties[0] !== undefined ) {
                    if (t.defaulturi !== undefined && t.defaulturi !== "") {
                        triple.s = t.defaulturi;
                    } else {
                        triple.s = editorconfig.baseURI + resourceID;
                    }
                    triple.p = properties[0].propertyURI;
                    triple.o = data;
                    triple.otype = "literal";
                    //triple.olang = "";

                    bfestore.store.push(triple);
                    formobject.store.push(triple);

                    var formgroup = $("#" + inputID, formobject.form).closest(".form-group");
                    var save = $(formgroup).find(".btn-toolbar")[0];

                    var bgvars = {
                        "tguid": triple.guid,
                        "tlabel": data,
                        "tlabelhover": data,
                        "fobjectid": formobjectID,
                        "inputid": inputID,
                        "triples": [triple]
                    };
                    var $buttongroup = editDeleteButtonGroup(bgvars);

                    $(save).append($buttongroup);
                    $("#" + inputID, formobject.form).val("");
                    if (properties[0].repeatable !== undefined && properties[0].repeatable == "false") {
                        $("#" + inputID, formobject.form).attr("disabled", true);
                    }


                }
            });
        }
        $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
    }

    // URIフィールドで入力されたURIデータを保存
    function setResourceFromLabel(formobjectID, resourceID, inputID) {
        var formobject = _.where(forms, {"id": formobjectID});
        formobject = formobject[0];
        //console.log(inputID);
        var data = $("#" + inputID, formobject.form).val();
        if (data !== undefined && data !== "") {
            var triple = {}
            triple.guid = guid();
            formobject.resourceTemplates.forEach(function(t) {
                var properties = _.where(t.propertyTemplates, {"guid": inputID})
                if ( properties[0] !== undefined ) {
                    if (t.defaulturi !== undefined && t.defaulturi !== "") {
                        triple.s = t.defaulturi;
                    } else {
                        triple.s = editorconfig.baseURI + resourceID;
                    }
                    triple.p = properties[0].propertyURI;
                    triple.o = data;
                    triple.otype = "uri";

                    bfestore.store.push(triple);
                    formobject.store.push(triple);

                    var $formgroup = $("#" + inputID, formobject.form).closest(".form-group");
                    var save = $formgroup.find(".btn-toolbar")[0];

                    var bgvars = {
                        "tguid": triple.guid,
                        "tlabel": triple.o,
                        "tlabelhover": triple.o,
                        "fobjectid": formobjectID,
                        "inputid": inputID,
                        "triples": [triple]
                    };
                    var $buttongroup = editDeleteButtonGroup(bgvars);

                    $(save).append($buttongroup);
                    $("#" + inputID, formobject.form).val("");
                    if (properties[0].repeatable !== undefined && properties[0].repeatable == "false") {
                        $("#" + inputID, formobject.form).attr("disabled", true);
                    }

                }
            });
        }
        $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
    }

    // Lookup機能（Twitter Typeaheadを使用）
    function setTypeahead(input) {
        var form = $(input).closest("form").eq(0);
        var formid = $(input).closest("form").eq(0).attr("id");
        formid = formid.replace('bfeditor-form-', '');
        var formobject = _.where(forms, {"id": formid});
        formobject = formobject[0];
        //console.log(formid);

        var pguid = $(input).attr("data-propertyguid");
        var p;
        formobject.resourceTemplates.forEach(function(t) {
            var properties = _.where(t.propertyTemplates, {"guid": pguid});
            //console.log(properties);
            if ( properties[0] !== undefined ) {
                p = properties[0];
            }
        });

        var uvfs = p.valueConstraint.useValuesFrom;
        var dshashes = [];
        uvfs.forEach(function(uvf){
        // var lups = _.where(lookups, {"scheme": uvf});
            var lu = lookups[uvf];

            bfelog.addMsg(new Error(), "DEBUG", "Setting typeahead scheme: " + uvf);
            bfelog.addMsg(new Error(), "DEBUG", "Lookup is", lu);

            var dshash = {};
            dshash.name = lu.name;
            dshash.source = function(query, process) {
                lu.load.source(query, process, formobject);
            };
            dshash.templates =  { header: '<h3>' + lu.name + '</h3>' };
            dshash.displayKey = 'value';
            dshashes.push(dshash);
        });

        bfelog.addMsg(new Error(), "DEBUG", "Data source hashes", dshashes);
        var opts = {
            minLength: 1,
            highlight: true,
            displayKey: 'value'
        };
        if ( dshashes.length === 1) {
            $( input ).typeahead(
                opts,
                dshashes[0]
            );
        } else if ( dshashes.length === 2) {
            $( input ).typeahead(
                opts,
                dshashes[0],
                dshashes[1]
            );
        } else if ( dshashes.length === 3) {
            $( input ).typeahead(
                opts,
                dshashes[0],
                dshashes[1],
                dshashes[2]
            );
        } else if ( dshashes.length === 4) {
            $( input ).typeahead(
                opts,
                dshashes[0],
                dshashes[1],
                dshashes[2],
                dshashes[3]
            );
        } else if ( dshashes.length === 5) {
            $( input ).typeahead(
                opts,
                dshashes[0],
                dshashes[1],
                dshashes[2],
                dshashes[3],
                dshashes[4]
            );
        } else if ( dshashes.length === 6) {
            $( input ).typeahead(
                opts,
                dshashes[0],
                dshashes[1],
                dshashes[2],
                dshashes[3],
                dshashes[4],
                dshashes[5]
            );
        }
        // Need more than 6?  That's crazy talk, man, crazy talk.

        $( input ).on("typeahead:selected", function(event, suggestionobject, datasetname) {
            bfelog.addMsg(new Error(), "DEBUG", "Typeahead selection made");
            var form = $("#" + event.target.id).closest("form").eq(0);
            var formid = $("#" + event.target.id).closest("form").eq(0).attr("id");
            formid = formid.replace('bfeditor-form-', '');
            var resourceid = $(form).children("div").eq(0).attr("id");
            var resourceURI = $(form).find("div[data-uri]").eq(0).attr("data-uri");

            var propertyguid = $("#" + event.target.id).attr("data-propertyguid");
            bfelog.addMsg(new Error(), "DEBUG", "propertyguid for typeahead input is " + propertyguid);

            var s = editorconfig.baseURI + resourceid;
            var p = "";
            var formobject = _.where(forms, {"id": formid});
            formobject = formobject[0];
            formobject.resourceTemplates.forEach(function(t) {
                var properties = _.where(t.propertyTemplates, {"guid": propertyguid});
                //console.log(properties);
                if ( properties[0] !== undefined ) {
                    p = properties[0];
                }
            });

            var lups = _.where(lookups, {"name": datasetname});
            var lu;
            if ( lups[0] !== undefined ) {
                bfelog.addMsg(new Error(), "DEBUG", "Found lookup for datasetname: " + datasetname, lups[0]);
                lu = lups[0].load;
            }
            // 選択されたリソースのURIとAuthorizedAccessPointを設定した後、もう一度当該リソースを検索して
            // その他関連のプロパティを設定する
            lu.getResource(resourceURI, p.propertyURI, suggestionobject, function(returntriples) {
                bfelog.addMsg(new Error(), "DEBUG", "Triples returned from lookup's getResource func:", returntriples);
                returntriples.forEach(function(t){
                    if (t.guid === undefined) {
                        var tguid = guid();
                        t.guid = tguid;
                    }
                    formobject.store.push(t);
                    bfestore.store.push(t);

                    // We only want to show those properties that relate to
                    // *this* resource.
                    if (t.s == resourceURI) {
                        formobject.resourceTemplates.forEach(function(rt) {
                            var properties = _.where(rt.propertyTemplates, {"propertyURI": t.p});
                            if ( properties[0] !== undefined ) {
                                var property = properties[0];
                                var pguid = property.guid;

                                var $formgroup = $("#" + pguid, formobject.form).closest(".form-group");
                                var save = $formgroup.find(".btn-toolbar")[0];

                                var tlabel = t.o;
                                if (t.otype == "uri") {
                                    var resourcedata = _.where(returntriples, {"s": t.o});
                                    var displaytriple = _.find(resourcedata, function(label) {
                                        return label.p.match(/label|title/i);
                                    });
                                    if (displaytriple !== undefined && displaytriple.o !== undefined) {
                                        tlabel = displaytriple.o;
                                    }
                                }

                                var setTriples = [t];
                                if (resourcedata !== undefined && resourcedata[0] !== undefined) {
                                    setTriples = resourcedata;
                                }
                                var bgvars = {
                                    "tguid": t.guid,
                                    "tlabel": tlabel,
                                    "tlabelhover": tlabel,
                                    "fobjectid": formobject.id,
                                    "inputid": pguid,
                                    "triples": setTriples
                                };
                                var $buttongroup = editDeleteButtonGroup(bgvars);

                                $(save).append($buttongroup);

                                $("#" + pguid, formobject.form).val("");
                                $("#" + pguid, formobject.form).typeahead('val', "");
                                $("#" + pguid, formobject.form).typeahead('close');

                                if (property.valueConstraint !== undefined && property.valueConstraint.repeatable !== undefined && property.valueConstraint.repeatable == "false") {
                                    var $el = $("#" + pguid, formobject.form)
                                    if ($el.is("input")) {
                                        $el.prop("disabled", true);
                                        $el.css( "background-color", "#EEEEEE" );
                                    } else {
                                        var $buttons = $("div.btn-group", $el).find("button");
                                        $buttons.each(function() {
                                            $( this ).prop("disabled", true);
                                       });
                                    }
                                }
                            }
                        });
                    }
                });
                bfestore.storeDedup();
                $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
            });
        });
    }

    // フィールドの編集画面を作成
    function editTriple(formobjectID, inputID, t) {
        var formobject = _.where(forms, {"id": formobjectID});
        formobject = formobject[0];
        bfelog.addMsg(new Error(), "DEBUG", "Editing triple: " + t.guid, t);
        $("#" + t.guid).empty();

        // 非表示状態を解除
        var $el = $("#" + inputID, formobject.form);
        if ($el.is("input") && $el.hasClass( "typeahead" )) {
            var $inputs = $("#" + inputID, formobject.form).parent().find("input[data-propertyguid='" + inputID +"']");
            // is this a hack because something is broken?
            $inputs.each(function() {
                $( this ).prop( "disabled", false );
                $( this ).removeAttr("disabled");
                $( this ).css( "background-color", "transparent" );
            });
        } else if ($el.is("input")) {
            $el.prop( "disabled", false );
            $el.removeAttr("disabled");
            //el.css( "background-color", "transparent" );
        } else {
            var $buttons = $("div.btn-group", $el).find("button");
            $buttons.each(function() {
                $( this ).prop( "disabled", false );
            });
        }

        //　値の復元
        if ($el.is("input") && t.otype == "literal") {
            $el.val(t.o);
        }

        // 保存済のトリプルを削除
        formobject.store = _.without(formobject.store, _.findWhere(formobject.store, {guid: t.guid}));
        bfestore.store = _.without(bfestore.store, _.findWhere(bfestore.store, {guid: t.guid}));
        $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
    }

    // リソースの編集画面を作成
    function editTriples(formobjectID, inputID, triples) {
        bfelog.addMsg(new Error(), "DEBUG", "Editing triples", triples);
        var resourceTypes = _.where(triples, {p: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"});
        bfelog.addMsg(new Error(), "DEBUG", "Triples represent these resourceTypes", resourceTypes);
        if (typeof resourceTypes[0] !== undefined && resourceTypes[0].rtID !== undefined) {
            // function openModal(callingformobjectid, rtguid, propertyguid, template) {
            var callingformobject = _.where(forms, {"id": formobjectID});
            callingformobject = callingformobject[0];

            var templates = _.where(resourceTemplates, {"id": resourceTypes[0].rtID});
            if (templates[0] !== undefined) {
                // The subject of the resource matched with the "type"
                bfelog.addMsg(new Error(), "DEBUG", "Opening modal for editing", triples);
                openModal(callingformobject.id, templates[0], resourceTypes[0].s, inputID, triples);
            }
        }

    }

    //　フィールドの削除
    function removeTriple(formobjectID, inputID, t) {
        var formobject = _.where(forms, {"id": formobjectID});
        formobject = formobject[0];
        bfelog.addMsg(new Error(), "DEBUG", "Removing triple: " + t.guid, t);
        $("#" + t.guid).empty();

        var $el = $("#" + inputID, formobject.form);
        if ($el.is("input") && $el.hasClass( "typeahead" )) {
            var $inputs = $("#" + inputID, formobject.form).parent().find("input[data-propertyguid='" + inputID +"']");
            // is this a hack because something is broken?
            $inputs.each(function() {
                $( this ).prop( "disabled", false );
                $( this ).removeAttr("disabled");
                $( this ).css( "background-color", "transparent" );
            });
        } else if ($el.is("input")) {
            $el.prop( "disabled", false );
            $el.removeAttr("disabled");
            //el.css( "background-color", "transparent" );
        } else {
            var $buttons = $("div.btn-group", $el).find("button");
            $buttons.each(function() {
                $( this ).prop( "disabled", false );
            });
        }
        formobject.store = _.without(formobject.store, _.findWhere(formobject.store, {guid: t.guid}));
        bfestore.store = _.without(bfestore.store, _.findWhere(bfestore.store, {guid: t.guid}));
        $("#bfeditor-debug").html(JSON.stringify(bfestore.store, undefined, " "));
    }

    // リソースの削除
    function removeTriples(formobjectID, inputID, triples) {
        bfelog.addMsg(new Error(), "DEBUG", "Removing triples for formobjectID: " + formobjectID + " and inputID: " + inputID, triples);
        triples.forEach(function(triple) {
            removeTriple(formobjectID, inputID, triple);
        });
    }

    /**
    * Generates a GUID string.
    * @returns {String} The generated GUID.
    * @example af8a8416-6e18-a307-bd9c-f2c947bbb3aa
    * @author Slavik Meltser (slavik@meltser.info).
    * @link http://slavik.meltser.info/?p=142
    */
    function guid() {
        function _p8(s) {
            var p = (Math.random().toString(16)+"000000000").substr(2,8);
            return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
        }
        return _p8() + _p8(true) + _p8(true) + _p8();
    }


});