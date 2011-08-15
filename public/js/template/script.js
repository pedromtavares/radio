// remap jQuery to $
(function($){
	//Tabs
	$(".tab_content:not(.tab_content:first)").hide(); //Hide all content except first
	$("ul.tabs li:first").addClass("active"); //Activate first tab
	
	//On Click Event
	$("ul.tabs li a").click(function() {
		$("ul.tabs li").removeClass("active"); //Remove any "active" class
		$(this).parent().addClass("active"); //Add "active" class to selected tab
		var activeTab = $(this).attr("href"); //Find the rel attribute value to identify the active tab + content
		$(".tab_content:visible").slideUp('500', function() {
			$(activeTab).slideDown('500'); // Slide in the active content
		});
		return false;
	});
	
	// Contact form
	$("form.contact").submit(function(){
		$("form.contact .error, form.contact .success").remove();
		$.ajax({
			type: 'POST',
			url: 'contact.php',
			data: $("form.contact").serialize(),
			success: function(result) {
				if (result=="SUCCESS") {
					$('#name, #email, #message').val('');
					$("form.contact").prepend('<p class="success" style="display:none">Mail sent successfully</p>');
				} else {
					$("form.contact").prepend('<p class="error" style="display:none">' + result + '</p>');
				}
				$("form.contact .error, form.contact .success").slideDown('500');
			}
		});
		return false;
	});
	
	// Tipsy
	$('.tooltip').tipsy({gravity: 's', offset: 2});
	
	// Fancybox
	$('a.fancybox').fancybox({
		'opacity'		: true,
		'overlayShow'	: false,
		'transitionIn'	: 'elastic',
		'transitionOut'	: 'elastic'
	});
})(window.jQuery);





















