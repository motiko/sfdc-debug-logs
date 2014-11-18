(function(){

var userId;
function inject(fn) {
    var script = document.createElement('script');
    script.setAttribute("type", "application/javascript");
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script); // run the script
    document.body.removeChild(script); // clean up
}

function sendBackUserId(){
    if(window.UserContext){
        window.postMessage({type:"userId",content:UserContext.userId},"*");
    }
}

window.addEventListener("message", function(event) {
    if(event.data.type === "userId"){
        userId = event.data.content;
    }
});

inject(sendBackUserId);

Mousetrap.bind(['ctrl+alt+d','command+option+d'],function(e){
    document.location.assign("/setup/ui/listApexTraces.apexp?user_id="+ userId+"&user_logging=true");
});

Mousetrap.bind(['ctrl+alt+o','command+option+o'],function(e){
    document.location.assign("/p/setup/custent/CustomObjectsPage");
});

Mousetrap.bind(['ctrl+alt+u','command+option+u'],function(e){
    document.location.assign("/005?setupid=ManageUsers");
});

Mousetrap.bind(['ctrl+alt+s','command+option+s'],function(e){
    document.location.assign("/_ui/platform/schema/ui/schemabuilder/SchemaBuilderUi?setupid=SchemaBuilder");
});

})();
