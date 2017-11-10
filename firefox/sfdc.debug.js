(function(){

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
    localStorage.setItem(key,value);
}

function getSetting(key){
    return localStorage.getItem(key);
}

init();

function init(){
    document.body.addEventListener('keyup',keyUpListener);
    var codeElement = document.querySelector('pre');
    var debugText = escapeHtml(codeElement.textContent);
    var res = debugText.split('\n').map(addTagsToKnownLines);
    res = res.reduce(toMultilineDivs);
    var codeBlock = document.querySelector('pre');
    codeBlock.innerHTML = '<div class="monokai" id="debugText">' + res + '</div>';
    document.querySelector('.oLeft').style.display ="none";
    var oRight = document.querySelector('.oRight');
    oRight.insertBefore(codeBlock,oRight.firstChild);
    addControllersContainer();
    addDropDowns();
    removeIllegalIdLinks();
    var debugElements = document.getElementsByClassName('debug');
    var userDebugDivs = toArray(debugElements);
    userDebugDivs.forEach(function(debugDiv){
        setTimeout(addExpnasionButtonsForUserDebugDivs.bind(null,debugDiv),0);
    });
    addCollapseAllButton();
    addCheckboxes();
}

function addControllersContainer(){
    var container = document.createElement('div');
    container.id = 'controllersContainer';
    addToTop(container);
}

function toArray(elemntList){
    return [].slice.call(elemntList);
}

function addDropDowns(){
    addController(generateStyleSelect());
    addController(generateFontSelect());
    var savedStyle = getSetting('style');
    if(savedStyle){
        var styleSelection = document.querySelector('#styleSelection');
        styleSelection.value = savedStyle;
        styleSelection.onchange();
    }
    var savedFontSize = getSetting('fontSize');
    var fontSize = savedFontSize || 18;
    var fontSizeSelection = document.querySelector('#fontSelection');
    fontSizeSelection.value = fontSize;
    fontSizeSelection.onchange();
}

function generateFontSelect(){
    var selectStyleContainer = document.createElement('span');
    selectStyleContainer.id = 'selectFontContainer';
    var label = document.createElement('label');
    label.textContent = 'Font Size:';
    label.for = 'fontSelection';
    var dropDown = document.createElement('select');
    dropDown.id = 'fontSelection';
    var size;
    for(size=12;size<29;size++){
        var opt = document.createElement('option');
        opt.value = size;
        opt.textContent = size;
        dropDown.appendChild(opt);
    }
    dropDown.onchange = function(event){
        document.querySelector('#debugText').style.fontSize = this.value + 'px';
        setSetting('fontSize',this.value);
    };
    selectStyleContainer.appendChild(label);
    selectStyleContainer.appendChild(dropDown);
    return selectStyleContainer;
}

function generateStyleSelect(){
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
    };
    selectStyleContainer.appendChild(label);
    selectStyleContainer.appendChild(dropDown);
    return selectStyleContainer;
}

function addCheckboxes(){
    var showSystemLabel = document.createElement('label');
    showSystemLabel.className = 'toggleHidden';
    showSystemLabel.innerHTML = '<input type="checkbox" name="checkbox" id="showSystem"/>Show <u>S</u>ystem Methods</label>';
    var showMethodLogLabel = document.createElement('label');
    showMethodLogLabel.className = 'toggleHidden';
    showMethodLogLabel.innerHTML = '<input type="checkbox" name="checkbox" checked="checked" id="showUserMethod" />Show <u>U</u>ser Methods</label>';
    var showTimeStamp = document.createElement('label');
    showTimeStamp.className = 'toggleHidden';
    showTimeStamp.innerHTML = '<input type="checkbox" name="checkbox" id="showTimestamps"/>Show <u>T</u>imestamps</label>';
    addToTop(showMethodLogLabel);
    addToTop(showSystemLabel);
    addToTop(showTimeStamp);
    document.getElementById('showTimestamps').checked = JSON.parse(getSetting('showTimeStamp'));
    document.getElementById('showTimestamps').onchange = toggleTimestamp;
    document.getElementById('showUserMethod').onchange = toogleHidden('methodLog');
    document.getElementById('showSystem').onchange = toogleHidden('systemMethodLog');
}

function toggleTimestamp(){
    var oldValue = JSON.parse(getSetting('showTimeStamp'));
    setSetting('showTimeStamp',!oldValue);
    document.location.reload();
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
    };
}

function addToTop(nodeElement){
    document.querySelector('.codeBlock').insertBefore(nodeElement,document.getElementById('debugText'));
}

function addController(controller){
    document.querySelector('#controllersContainer').appendChild(controller);
}

function keyUpListener(event){
    if(event.keyCode  == 85){ // 'u'
        clickOn(document.querySelector('#showUserMethod'));
    }
    else if(event.keyCode  == 83){ // 's'
        clickOn(document.querySelector('#showSystem'));
    }
    else if(event.keyCode  == 69){ // 'e'
        clickOn(document.querySelector('#collapseAllButton'));
    }
    else if(event.keyCode  == 84){ // 't'
        clickOn(document.querySelector('#showTimestamps'));
    }
}

function clickOn(nodeElement){
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    nodeElement.dispatchEvent(event, true);
}

function notHidden(element){
    return element.offsetParent  !== null;
}


function isVisibleElement(element){
    return element.getBoundingClientRect().top >= 0;
}

function addExpnasionButtonsForUserDebugDivs(userDebugDiv){
    var debugLevel = userDebugDiv.innerHTML.match(/\[\d+\](\|[A-Z]+\|)/);
    if(!debugLevel) return;
    debugLevel = debugLevel[1];
    var debugParts = userDebugDiv.innerHTML.split(debugLevel);
    debugger
    var debugText = unescapeHtml(debugParts[1]);

    debugTextParentObj = document.getElementById("debugText")
    if(looksLikeHtml(debugText) || looksLikeSfdcObject(debugText) || isJsonString(debugText)){
        var buttonExpand = document.createElement('button');
        buttonExpand.onclick = expandUserDebug;
        buttonExpand.onmouseup = haltEvent;
        buttonExpand.className = 'expandUserDebugBtn collapsed myButton';
        buttonExpand.textContent = '+';
        debugTextParentObj.insertBefore(buttonExpand,userDebugDiv);
    }
}

function toMultilineDivs(prevVal,curLine,index){
    if(index == 1){ // handling first line
        return '<div class="rest">' + prevVal + '</div>' + curLine ;
    }
    else if(curLine.lastIndexOf('</div>') ==  curLine.length - '</div>'.length && curLine.length - '</div>'.length != -1){ // current line ends with <div> tag all good
        return prevVal + curLine;
    }
    else{ // expanding <div> to mutliline (e.g. LIMIT_USAGE_FOR_NS is multiline and cant recognise each line separately or USER_DEBUG with /n)
        return prevVal.substr(0,prevVal.length - '</div>'.length) + '\n' + curLine + '</div>';
    }
}

function addTagsToKnownLines(curLine){
    if(curLine.indexOf('Execute Anonymous:') === 0){
        return '<div class="system searchable">' + curLine + '</div>';
    }
    if(curLine.search(idRegex) > -1){
        curLine = curLine.replace(idRegex,'<a href="/$&" class="idLink">$&</a>');
    }
    var timeStampIndex = curLine.indexOf('|');
    var cutLine;
    if(timeStampIndex > -1){
        cutLine = curLine.substr(timeStampIndex + 1);
    }
    var resultTag = '';
    var i;
    for(i=0; i<logEntryToDivTagClass.length ; i++){
        if(curLine.indexOf(logEntryToDivTagClass[i].logEntry) > -1){
            resultTag = '<div class="' + logEntryToDivTagClass[i].divClass + '">' +
            (JSON.parse(getSetting('showTimeStamp')) ? curLine : cutLine) + '</div>';
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
    request('/services/data/v29.0/sobjects').then(function(response){
        var sobjects = JSON.parse(response).sobjects;
        keyPrefixes = sobjects.filter(function(sobj){
            return (sobj.keyPrefix !== undefined);
        }).map(function(sobjectDescribe){
            return sobjectDescribe.keyPrefix;
        });
        keyPrefixes.push('03d'); // validation rule
        var idLinks = document.getElementsByClassName('idLink');
        toArray(idLinks).forEach(function(link){
            if(!isLegalId(link.textContent)){
                link.className = 'disableClick';
            }
        });
    });
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
    };
}

function expandUserDebug(){
    var debugNode = this.nextElementSibling;
    var  oldHtmlVal =  debugNode.innerHTML;
    var debugNodeText = debugNode.textContent;
    debugger
    if(looksLikeHtml(debugNodeText)){
        debugNode.textContent  = html_beautify(debugNodeText);
    }else if(looksLikeSfdcObject(debugNodeText)){
        debugNode.textContent  = js_beautify(sfdcObjectBeautify(debugNodeText));
    }else if(isJsonString(debugNodeText)){
        debugNode.textContent  = js_beautify(debugNodeText);
    }
    if(debugNodeText.search(idRegex) > -1){
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
    };
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

function contains(searchString){
    return function(nodeElem){
        return nodeElem.innerHTML.indexOf(searchString) > -1;
    };
}

function request(url,method){
    method = method || 'GET';
    return new Promise(function(fulfill,reject){
        var xhr = new XMLHttpRequest();
        xhr.open(method,url);
        xhr.onload = function(){
            if( xhr.status.toString().indexOf('2') === 0){
                fulfill(xhr.response);
            }else{
                reject(Error(xhr.statusText));
            }
        };
        xhr.onerror = function(){
            rejected(Error("Network Error"));
        };
        xhr.setRequestHeader('Authorization','Bearer ' + sid);
        xhr.send();
    });
}
})();
