var RECT_HEIGHT = 50;

// Function that builds the color scale
var uc3_getColor = d3.scaleLinear()
.range(["white", "#e6194B"])
.domain([0,1]);

// Get y value
function uc3_yVal(bin) {
    y_val = bin.map( function(x) {
        if(x.length>=4)
            return x[3];
        else
            return 1;
    }).reduce(function(x,y){return x+y},0);

    return y_val;
}


// Add a track to the heatmap
function uc3_addTracks(g, data) {

    g.svg.selectAll()
        .data(data, function(d) {return d.group+':'+d.variable;})
        .enter()
        .append("rect")
        .attr("x", function(d) { return g.xAxisScale(d.group) })
        .attr("y", function(d) { return g.y(d.variable) })
        .attr("width", function(b){return g.xAxisScale(b.x1)-g.xAxisScale(b.x0)} )
        .attr("height", g.y.bandwidth() ) 
        .style("fill", function(d) { return uc3_getColor(d.value)} )
}


// Filter data taking only mutations with type in mutationTypes (array of selected mutation types)
function uc3_getFilteredData(data, mutationTypes) {

    return data.filter( function(mutation) {

        return mutationTypes.map( 
            function(t){ 
                if(t.from=="*" && t.to=="*")
                    return true;
                if(t.from=="*") 
                    return t.to==mutation[2]  
                if(t.to=="*") 
                    return t.from==mutation[1]  

                return t.from == mutation[1] && t.to==mutation[2]  
            }
        ).reduce( function(t1,t2){ return t1 || t2 });


    });
}

// This function (re-)builds the graph g provided the number of bins and selected mutation types
function uc3_update(data, g, binSize, mutationTypes) {

    // bins intervals centered on 0
    ticks =  getTicks(g.xAxisScale.domain()[0], g.xAxisScale.domain()[1], binSize);

    // Configure the histogram function
    var histogram = d3.histogram()
    .value(function(d) {return d[0]})
    .domain(g.xAxisScale.domain())       
    .thresholds(ticks); 


    // Binned data (array, one element is the binned data for a specific tumor type in data)
    binned = data.map(function(tumorType){return histogram(uc3_getFilteredData(tumorType.data, mutationTypes));});

    // Max elements contained in a bin (array, one for each binned data in binned)
    maxx = binned.map(function(bins){ return d3.max(bins, function(d) { return +uc3_yVal(d) }); });

    g.global_max = maxx.reduce(function(a, b) {return Math.max(a, b);});

    // Add to each bin the normalized value
    var normalized = binned.map(function(bins,i){  

        return bins.map( function(b){
            b.value = uc3_yVal(b) / g.global_max; //maxx[i];
            b.variable = data[i].type;
            b.group = b.x0;
            return b;
        });
    });


    // Different tracks titles
    var types = data.map(function(d){return d.type});

    // Setup y axis
    g.y = d3.scaleBand()
        .range([ g.height, 0 ])
        .domain(types)
        .padding(0.01);

    g.yAxis.call(d3.axisLeft(g.y));

    // Rotate y-axis labels
    $(".y-axis text").attr("transform", "rotate(270) translate(25,-17)");


    // Merge all binned data (the different type is tracked by the property "variable" within each bin)
    union = binned.reduce(function(a,b){return a.concat(b)});

    // Add the tracks to the plot
    uc3_addTracks(g, union);
    
    
    // ADD LEGEND
    values = Array.from(Array(g.global_max).keys())
    
    // remove 
    d3.selectAll(".legend").remove();
    d3.selectAll(".legend_ticks").remove();
    
    // create element for legend
    legend_el = d3.select("#uc3 svg").append("g").lower().attr("transform","translate(" + g.margin.left + "," + 0 + ")")
    
    var legend = legend_el.selectAll(".legend") 
    .data(values, function(d) {return d;})
    .enter().append("g")
    .attr("class", "legend");
    
    legendElementWidth = g.width/values.length;
    height = 0;
    gridSize = 10;

    legend.append("rect")
        .attr("x", function(d, i){ return legendElementWidth * i;})
        .attr("y", height)
        .attr("width", legendElementWidth)
        .attr("height", gridSize/2)
        .style("fill", function(d, i) {return uc3_getColor(d/g.global_max)});

    // Setup the x axis
    legend_scale = d3.scaleLinear().domain([0,g.global_max]).range([0,g.width]);
    legend_xAxis = legend_el.append("g").attr("class","legend_ticks").attr("transform", "translate(0," + 0+ ")");
    
    yAxisTicks = legend_scale.ticks().filter(function(tick){return  Number.isInteger(tick);});
    yAxis = d3.axisBottom(legend_scale)
    .tickValues(yAxisTicks)
    .tickFormat(d3.format('d'));
    legend_xAxis.call(yAxis);

}

/* This function rescales the x axis, given the new provided domain (range) */
function uc3_rescaleX(data, g, binSize, range, mutationTypes) {

    g.xAxisScale = d3.scaleLinear().domain([range.min,range.max]).range([0, g.width]);

    g.xAxis
        .transition()
        .duration(500)
        .call(d3.axisBottom(g.xAxisScale).tickFormat(function(d) { return d3.format(".2s")(d); }));

    // Recompute the bins and rebuild the plot
    uc3_update(data, g, binSize, mutationTypes);
}

/* Build the graph with an initial number of bins */
function uc3(data, binSize, range, mutationTypes) {

    var g = {} // here we put all useful objects describing our plot

    // Set the dimensions and margins of the plot
    g.margin = {top: 50, right: 30, bottom: 30, left: 50};
    g.width  = 700 - 2*g.margin.left;
    g.height = 150*data.length - g.margin.top - g.margin.bottom;

    g.binSize = binSize;

    // Remove any pre-existing plot
    d3.select("#uc3 svg").html("");

    // Setup the plot container
    g.svg = d3.select("#uc3 svg")  
        .append("g")
        .attr("transform","translate(" + g.margin.left + "," + g.margin.top + ")");

    // Setup the x axis
    g.xAxisScale = d3.scaleLinear().domain([range.min,range.max]).range([0, g.width]);
    g.xAxis = g.svg.append("g").attr("transform", "translate(0," + g.height + ")");
    g.xAxis.call(d3.axisBottom(g.xAxisScale));

    // Add the y axis (just the svg element, later it will be configured)
    g.yAxis = g.svg.append("g").attr("class","y-axis");

    // Label for the x axis 
    g.svg.append("text")             
        .attr("transform",
              "translate(" + (g.width/2) + " ," + 
              (g.height + g.margin.top + 30) + ")")
        .style("text-anchor", "middle")
        .style("font-size", "0.8em")
        .text("distance (bp)");

    // Compute the bins and build the plot
    uc3_update(data, g, binSize, mutationTypes);

    // Return the plot description
    return g;
}