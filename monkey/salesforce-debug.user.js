// ==UserScript==
// @name         Beautify Salesforce Debug View
// @namespace    SFDC
// @version      0.1.15
// @description Beautify Salesforce Debug View
// @author       Moti
// @match        https://*.salesforce.com/p/setup/layout/ApexDebugLogDetailEdit/*
// @require beautify.js
// @require beautify-html.js
// @resource debug_css https://raw.githubusercontent.com/motiko/sfdc-debug-logs/master/monkey/debug.css
// @grant    GM_addStyle
// @grant    GM_getResourceText
// @grant    GM_setValue
// @grant    GM_getValue
// @run-at document-end
// ==/UserScript==

(function(){


// Monkey only
var debug_css = GM_getResourceText("debug_css");
GM_addStyle(debug_css);
//
var selectedText,
    currentResult,
    maxResult,
    keyPrefixes = [],
    sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2],
    idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g,
    debugDescRegex = /(\d\d:\d\d:\d\d\.\d{3}\s+\(\d{8}\))\|(\w+)\|/,
    logEntryToDivTagClass = [{
        logEntry: '|USER_DEBUG',
        divClass: 'debug'
    },{
        logEntry: '|SYSTEM_',
        divClass: 'system systemMethodLog searchable'
    },{
        logEntry: '|SOQL_EXECUTE_',
        divClass: 'soql searchable wrap'
    },{
        logEntry: '|SOQL_EXECUTE_END',
        divClass: 'soql searchable wrap'
    },{
        logEntry: '|METHOD_',
        divClass: 'method methodLog searchable'
    },{
        logEntry: '|CONSTRUCTOR_',
        divClass: 'method methodLog searchable'
    },{
        logEntry: '|EXCEPTION_',
        divClass: 'err searchable'
    },{
        logEntry: '|FATAL_ERROR',
        divClass: 'err searchable'
    },{
        logEntry: '|CODE_UNIT',
        divClass: 'method searchable'
    },{
        logEntry: '|CALLOUT',
        divClass: 'callout searchable'
    },{
        logEntry: '|VALIDATION_',
        divClass: 'method searchable'
    },{
        logEntry: '|EXECUTION_',
        divClass: 'rest searchable'
    },{
        logEntry: '|DML_BEGIN',
        divClass: 'rest searchable'
    },{
        logEntry: '|DML_END',
        divClass: 'rest searchable'
    },{
        logEntry: '|ENTERING_MANAGED_PKG',
        divClass: 'system systemMethodLog searchable'
    }
    ];

function setSetting(key,value){
    if(typeof GM_setValue === "function"){
        GM_setValue(key,value)
    }else{
        localStorage.setItem(key,value);
    }
}

function getSetting(key){
    if(typeof GM_getValue === "function"){
        return GM_getValue(key);
    }else{
        return localStorage.getItem(key);
    }
}

init();

/*function mapSeries(arr,iterator,callback){
    callback = callback || function(){};
    if(!arr.length){
        callback();
    }
    var index = 0;
    var result = [];
    var itearate = function(){
        result[index] = iterator(result[index],);
    }
}
*/
function init(){
    console.time('init');
    document.body.addEventListener('keyup',keyUpListener);
    //document.body.addEventListener('mouseup',searchSelectedText);
    var codeElement = document.querySelector('pre');
    var debugText = escapeHtml(codeElement.textContent);
    console.time('addTags');
    var res = debugText.split('\n').map(addTagsToKnownLines).reduce(toMultilineDivs);

    console.timeEnd('addTags');
    var codeBlock = document.querySelector('pre');
    codeBlock.innerHTML = '<div class="monokai" id="debugText">' + res + '</div>';
    document.querySelector('.oLeft').style.display ="none";
    var oRight = document.querySelector('.oRight');
    oRight.insertBefore(codeBlock,oRight.firstChild);
    addControllersContainer();
    addCheckboxes();
    addDropDown();
    if(!getSetting('dontShowSearchHint')){
        addSearchHint();
    }
    removeIllegalIdLinks();
    var debugElements = document.getElementsByClassName('debug')
    console.log(debugElements.length);
    var userDebugDivs = toArray(debugElements);
    userDebugDivs.forEach(function(debugDiv){
        setTimeout(addExpnasionButtonsForUserDebugDivs.bind(null,debugDiv),0);
    });
    addCollapseAllButton();
    console.timeEnd('init');
}

function addControllersContainer(){
    var container = document.createElement('div');
    container.id = 'controllersContainer';
    addToTop(container);
}

function toArray(elemntList){
    return [].slice.call(elemntList);
}

function addSearchHint(){
    var hintContainer = document.createElement('span');
    hintContainer.id = 'hintContainer';
    var hint = document.createElement('span');
    hint.innerHTML = 'Tip: To open debug logs press <b>Ctrl+Alt+d</b> (Command+d) from any salesforce page';
    var hideTip = document.createElement('a');
    hideTip.textContent = 'X';
    hideTip.onclick = function(){
        hintContainer.style.display = 'none';
        setSetting('dontShowSearchHint',true);
    }
    hintContainer.appendChild(hideTip);
    hintContainer.appendChild(hint);
    addToTop(hintContainer);
}

function addDropDown(){
    var selectStyleContainer = document.createElement('span');
    selectStyleContainer.id = 'selectStyleContainer';
    var label = document.createElement('label');
    label.textContent = 'Pick Style: ';
    label.for = 'styleSelection';
    var dropDown = document.createElement('select');
    dropDown.id = 'styleSelection';
    var styles = [{name:'monokai',label:'Monokai'},{name:'bw',label:'Black/White'},{name:'emacs',label:'Emacs'}];
    styles.forEach(function(style){
        var opt = document.createElement('option');
        opt.value = style.name;
        opt.textContent = style.label;
        dropDown.appendChild(opt);
    });
    dropDown.onchange = function(event){
        document.querySelector('#debugText').className = this.value;
        setSetting('style',this.value);
    }
    selectStyleContainer.appendChild(label);
    selectStyleContainer.appendChild(dropDown);
    addController(selectStyleContainer);
    var savedStyle = getSetting('style');
    if(savedStyle){
        dropDown.value = savedStyle;
        dropDown.onchange();
    }
}

function addCheckboxes(){
    var showSystemLabel = document.createElement('label');
    showSystemLabel.className = 'toggleHidden';
    showSystemLabel.innerHTML = '<input type="checkbox" name="checkbox" id="showSystem" />Show <u>S</u>ystem Methods</label>';
    var showMethodLog = document.createElement('label');
    showMethodLog.className = 'toggleHidden';
    showMethodLog.innerHTML = '<input type="checkbox" name="checkbox" checked="checked" id="showUserMethod"  />Show <u>U</u>ser Methods</label>';
    addController(showMethodLog);
    addController(showSystemLabel);
    var showUser = document.getElementById('showUserMethod');
    showUser.onchange = toogleHidden('methodLog');
    var showSystem = document.getElementById('showSystem');
    showSystem.onchange = toogleHidden('systemMethodLog');
}

function addCollapseAllButton(){
    var button = document.createElement('button');
    button.innerHTML = '<u>E</u>xpand All';
    button.onclick = colapseAll;
    button.id = 'collapseAllButton';
    button.className = 'myButton';
    addToTop(button);
}

function colapseAll(){
    toArray(document.querySelectorAll('.expandUserDebugBtn.collapsed')).forEach(function(button){
        setTimeout(expandUserDebug.bind(button),0);
    });
    this.innerHTML = 'Collaps<u>e</u> All';
    this.onclick = function(){
        toArray(document.querySelectorAll('.expandUserDebugBtn.expanded')).forEach(function(button){
            setTimeout(button.onclick.bind(button),0);
        });
        this.innerHTML = '<u>E</u>xpand All';
        this.onclick = colapseAll;
    }
}

function addToTop(nodeElement){
    document.querySelector('.codeBlock').insertBefore(nodeElement,document.getElementById('debugText'));
}

function addController(controller){
    document.querySelector('#controllersContainer').appendChild(controller);
}

function keyUpListener(event){
    /*if(event.keyCode  == 70){ // 'f'
        if(currentResult === undefined || currentResult === maxResult){
            currentResult = -1;
        }
        currentResult++;
        goToResult(currentResult);
    }
    else if(event.keyCode  == 66){ // 'b'
        if(currentResult === undefined || currentResult === 0){
            currentResult = maxResult + 1;
        }
        currentResult--;
        goToResult(currentResult);
    }
    else*/
    if(event.keyCode  == 27){ // 'esc'
        removeHighlightingOfSearchResults();
    }
    else if(event.keyCode  == 85){ // 'u'
        clickOn(document.querySelector('#showUserMethod'));
    }
    else if(event.keyCode  == 83){ // 's'
        clickOn(document.querySelector('#showSystem'));
    }
    else if(event.keyCode  == 69){ // 'e'
        clickOn(document.querySelector('#collapseAllButton'));
    }
}

function clickOn(nodeElement){
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    nodeElement.dispatchEvent(event, true);
}

function goToResult(resultNum){
    document.location.replace('#result' + resultNum);
    document.body.addEventListener('keyup',keyUpListener);
    var previouslySelectdElement = document.querySelector('.currentResult')
    if(previouslySelectdElement){
        previouslySelectdElement.classList.remove('currentResult');
    }
    document.querySelector('span.highlightSearchResult[data-number="' + resultNum + '"]')
            .classList.add('currentResult');
}

function removeHighlightingOfSearchResults(){
    currentResult = 0;
    maxResult = 0;
    toArray(document.querySelectorAll('.highlightSearchResult') ).forEach(function(span){
        var highlightedText = span.textContent;
        var textNode = document.createTextNode(highlightedText);
        span.parentElement.insertBefore(textNode,span);
        span.parentElement.removeChild(span);
    });
    toArray(document.querySelectorAll('.searchResultAnchor') ).forEach(function(a){
        a.parentElement.removeChild(a);
    });
}

function searchSelectedText(event){
    if(event.button == 2 || !event.altKey){
        return;
    }
    selectedText = document.getSelection().toString();
    removeHighlightingOfSearchResults();
    if(!selectedText){
        currentResult = 0;
        maxResult = 0;
        return;
    }
    selectedText = escapeHtml(selectedText);
    var searchableElements = toArray(document.querySelectorAll('#debugText .searchable') );
    var resultNum =0 ;
    searchableElements.filter(notHidden).filter(conatins(selectedText)).forEach(function(div){
        var regExp = new RegExp(escapeRegExp(selectedText),'gi');
        div.innerHTML = div.innerText.replace(regExp,function(match){
            var resultString = '<a name="result' + resultNum
            + '" class="searchResultAnchor" data-number="'
            + resultNum + '"></a><span class="highlightSearchResult" data-number="' + resultNum + '">'
            + match +'</span>';
            resultNum++;
            return resultString;
        });
        div.innerHTML = div.innerHTML.replace(idRegex,withLegalIdLink);
        maxResult = resultNum-1;
    });
    markNearestSearchResult();
}

function notHidden(element){
    return element.offsetParent  !== null;
}

function markNearestSearchResult(){
    var visibleSearchResults =  toArray(document.querySelectorAll('.searchResultAnchor'))
                                .filter(isVisibleElement);
    if(visibleSearchResults.length > 0){
        var mouseY = event.clientY;
        var closest = visibleSearchResults.map(function(anchor){
            var anchorY = anchor.getBoundingClientRect().top;
            return {element: anchor,distance:Math.abs(mouseY - anchorY)};
        }).reduce(function(found,current){
            if(current.distance < found.distance){
                return current;
            }
            return found;
        });
        currentResult = parseInt(closest.element.dataset.number,10);
        document.querySelector('span.highlightSearchResult[data-number="' + currentResult + '"]')
            .classList.add('currentResult');
    }
}

function isVisibleElement(element){
    return element.getBoundingClientRect().top >= 0;
}

function highlightResults(resultNum){
    return
}

function addExpnasionButtonsForUserDebugDivs(userDebugDiv){
    var debugParts = userDebugDiv.innerHTML.split('|DEBUG|');
    userDebugDiv.innerHTML = '<span class="debugHeader searchable">' +
            debugParts[0] + '|DEBUG| </span> <div class="debugContent searchable">' +
            debugParts[1] + '</div>';
    var debugText = unescapeHtml(debugParts[1]);
    if(looksLikeHtml(debugText) || looksLikeSfdcObject(debugText) || isJsonString(debugText)){
        var buttonExpand = document.createElement('button');
        buttonExpand.onclick = expandUserDebug;
        buttonExpand.onmouseup = haltEvent;
        buttonExpand.className = 'expandUserDebugBtn collapsed myButton';
        buttonExpand.textContent = '+';
        userDebugDiv.insertBefore(buttonExpand,userDebugDiv.children[0]);
    }
}

function toMultilineDivs(prevVal,curLine,index){
    if(index == 1){ // handling first line
        return '<div class="rest">' + prevVal + '</div>' + curLine ;
    }
    else if(curLine.lastIndexOf('</div>') ==  curLine.length - '</div>'.length){ // current line ends with <div> tag all good
        return prevVal + curLine;
    }
    else{ // expanding <div> to mutliline (e.g. LIMIT_USAGE_FOR_NS is multiline and cant recognise each line separately)
        return prevVal.substr(0,prevVal.length - '</div>'.length) + '\n' + curLine + '</div>';
    }
}

function addTagsToKnownLines(curLine){
    if(curLine.indexOf('Execute Anonymous:') == 0){
        return '<div class="system searchable">' + curLine + '</div>';
    }
    if(curLine.search(idRegex) > -1){
        curLine = curLine.replace(idRegex,'<a href="/$&" class="idLink">$&</a>');
    }
    var resultTag = '';
    var i;
    for(i=0; i<logEntryToDivTagClass.length ; i++){
        if(curLine.indexOf(logEntryToDivTagClass[i].logEntry) > -1){
            resultTag = '<div class="' + logEntryToDivTagClass[i].divClass + '">' +  curLine + '</div>';
            break;
        }
    }
    if(resultTag){
        return resultTag;
    }
    var splitedDebugLine = curLine.split('|');
    if(!splitedDebugLine || splitedDebugLine.length <= 2){
        return curLine;
    }
    return '<div class="rest searchable">' + curLine +'</div>';
}

function haltEvent(event){
    event.stopPropagation();
}

function removeIllegalIdLinks(){
    var xhr = new XMLHttpRequest();
    xhr.open('GET','/services/data/v29.0/sobjects');
    xhr.onload = function(event){
        var sobjects = JSON.parse(this.responseText).sobjects;
        keyPrefixes = sobjects.filter(function(sobj){
            return (sobj.keyPrefix != undefined);
        }).map(function(sobjectDescribe){
            return sobjectDescribe.keyPrefix;
        });
        keyPrefixes.push('03d') // validation rule
        var idLinks = document.getElementsByClassName('idLink');
        toArray(idLinks).forEach(function(link){
            if(!isLegalId(link.innerText)){
                link.className = 'disableClick';
            }
        });
    }
    xhr.setRequestHeader('Authorization','Bearer ' + sid);
    xhr.send();
}

function isLegalId(id){
    return ( keyPrefixes.indexOf( id.substr(0,3) ) > -1 );
}

function toogleHidden(className){
    return function(event){
        var systemLogs =toArray(document.getElementsByClassName(className)) ;
        systemLogs.forEach(function(systemLog){
            systemLog.style.display = event.srcElement.checked ? 'block' : 'none';
        });
    }
}

function expandUserDebug(){
    var debugNode = this.nextElementSibling.nextElementSibling;
    var  oldHtmlVal =  debugNode.innerHTML;
    var debugNodeinnerText = debugNode.textContent;
    if(looksLikeHtml(debugNodeinnerText)){
        debugNode.textContent  = html_beautify(debugNodeinnerText);
    }else if(looksLikeSfdcObject(debugNodeinnerText)){
        debugNode.textContent  = js_beautify(sfdcObjectBeautify(debugNodeinnerText));
    }else if(isJsonString(debugNodeinnerText)){
        debugNode.textContent  = js_beautify(debugNodeinnerText);
    }
    if(debugNodeinnerText.search(idRegex) > -1){
        debugNode.innerHTML = debugNode.textContent.replace(idRegex,withLegalIdLink);
    }
    this.textContent = '-';
    this.classList.add('expanded');
    this.classList.remove('collapsed');
    this.onclick = function(){
        debugNode.innerHTML = oldHtmlVal;
        this.classList.remove('expanded');
        this.classList.add('collapsed');
        this.textContent = '+';
        this.onclick = expandUserDebug;
        this.onmouseup = haltEvent;
    }
}

function withLegalIdLink(id){
    if(isLegalId(id)){
        return '<a href="/' + id + '" class="idLink">' + id + '</a>';
    }
    else{
        return id;
    }
}

function sfdcObjectBeautify(string){
    string = string.replace(/={/g,':{');
    return string.replace(/([{| |\[]\w+)=(.+?)(?=, |},|}\)|:{|])/g,function(match,p1,p2){
        return p1 + ":'" + p2  + "'" ;
    });
}

function looksLikeSfdcObject(string){
    return string.match(/\w+:{\w+=.+,?\s*}/);
}

function looksLikeHtml(source) {
    var trimmed = source.replace(/^[ \t\n\r]+/, '');
    return (trimmed && trimmed.substring(0, 1) === '<');
}

function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function escapeHtml(text) {
    var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}


function unescapeHtml(str) {
    return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'');
}


function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function conatins(searchString){
    return function(nodeElem){
        return nodeElem.innerHTML.indexOf(searchString) > -1;
    }
}

})();