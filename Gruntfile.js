//----------------------------------------------------------------------------------------------------------------------
// MaxInscribedCircle Gruntfile
//----------------------------------------------------------------------------------------------------------------------

module.exports = function(grunt)
{
    grunt.initConfig({
        clean: ['dist'],
        browserify: {
            debug: {
                options: {
                    browserifyOptions: {
                        debug: true,
                        standalone: 'maxInscribedCircle'
                    }
                },
                files: {
                    "./dist/max-inscribed-circle.js": "maxInscribedCircle.js"
                }
            },
            prod: {
                options: {
                    browserifyOptions: {
                        standalone: 'maxInscribedCircle'
                    },
                    plugin: [ ["minifyify", { map: false }] ]
                },
                files: {
                    "./dist/max-inscribed-circle.min.js": "maxInscribedCircle.js"
                }
            }
        },
        watch: {
            maxInscribedCircle: {
                files: ["maxInscribedCircle.js"],
                tasks: ["browserify:debug"]
            }
        },
        eslint: {
            src: {
                src: ['Gruntfile.js', 'src/**/*.js'],
                options: { configFile: '.eslintrc' }
            },
            test: {
                src: ['test/**/*.js'],
                options: { configFile: 'test/.eslintrc' }
            }
        }
    });

    //------------------------------------------------------------------------------------------------------------------

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks("gruntify-eslint");

    //------------------------------------------------------------------------------------------------------------------

    grunt.registerTask("build-debug", ["eslint", "clean", "browserify:debug"]);
    grunt.registerTask("build", ["eslint", "clean", "browserify"]);
    grunt.registerTask("default", ["build-dev", 'watch']);

    //------------------------------------------------------------------------------------------------------------------
};

//----------------------------------------------------------------------------------------------------------------------
