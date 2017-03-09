'use strict'

const path = require('path')
const extend = require('util')._extend;

const argv = require('yargs').argv
const babel = require('gulp-babel')
const browserify = require('browserify')
const buffer = require('vinyl-buffer')
const cleanCSS = require('gulp-clean-css')
const concat = require('gulp-concat')
const connect = require('connect')
const fs = require('fs')

const gulp = require('gulp-help')(require('gulp'), {})
const gutil = require('gulp-util')
const https = require('https')
const ifElse = require('gulp-if-else')

const livereload = require('gulp-livereload')

const notify = require('gulp-notify')
const pem = require('pem')
const sass = require('gulp-sass')
const serveStatic = require('serve-static')
const size = require('gulp-size')
const source = require('vinyl-source-stream')
const sourcemaps = require('gulp-sourcemaps')
const uglify = require('gulp-uglify')
const watchify = require('watchify')

const NODE_ENV = process.env.NODE_ENV || 'development'
const NODE_PATH = process.env.NODE_PATH || path.join(__dirname, 'node_modules')

const deployMode = argv.production ? argv.production : (process.env.NODE_ENV === 'production')

let watcher
// Default options for filesize stats.
let sizeOptions = {showTotal: true, showFiles: true}
let paths = {
    src: {
        fonts: [

        ],
    },
    target: {
        fonts: path.join(__dirname, 'public', 'font'),
    },
}

if (deployMode) gutil.log('Running gulp optimized for deployment...')


gulp.task('js', 'Process all application Javascript.', (done) => {
    let b = browserify({
        cache: {},
        debug: false,
        entries: './js/index.js',
        packageCache: {},
    })
    b.ignore('crypto')
    b.ignore('buffer')
    b.ignore('process')
    b.ignore('util')

    if (watcher) b.plugin(watchify)
    b.bundle()
    .pipe(source('index.js'))
    .pipe(buffer())
    .pipe(ifElse(!deployMode, () => {
        return sourcemaps.init({loadMaps: true})
    }))
    .pipe(ifElse(!deployMode, sourcemaps.write))
    .pipe(ifElse(deployMode, uglify))
    .on('error', notify.onError('Error: <%= error.message %>'))
    .on('end', () => {
        if (watcher) livereload.changed('index.js')
        done()
    })
    .pipe(gulp.dest('./public/'))
    .pipe(size(extend({title: 'js'}, sizeOptions)))
})


/**
 * Generate one css file out of all app styles.scss files and it's imports.
 */
gulp.task('scss', 'Find all scss files from the apps directory, concat them and save as one css file.', () => {
    return gulp.src('./scss/styles.scss')
    .pipe(sass({includePaths: NODE_PATH}))
    .on('error', notify.onError('Error: <%= error.message %>'))
    .pipe(concat('styles.css'))
    .pipe(ifElse(deployMode, () => cleanCSS({
        advanced: true,
    })))
    .pipe(gulp.dest('./public/'))
    .pipe(size(extend({title: 'scss'}, sizeOptions)))
    .pipe(ifElse(watcher, livereload))
})


gulp.task('watch', 'Start a development server and watch for changes.', () => {
    watcher = true
    pem.createCertificate({days: 1, selfSigned: true}, (err, keys) => {
        livereload.listen({cert: keys.certificate, key: keys.serviceKey, silent: false})
        const app = connect()
        app.use(serveStatic(path.join(__dirname, 'public')))
        https.createServer({cert: keys.certificate, key: keys.serviceKey}, app).listen(8999)
    })
    // Changes in one of the linked developing packages will
    // trigger a rebuild for the browserified peer. This doesn't
    // automatically trigger a nodemon reload.
    gulp.watch([
        path.join(__dirname, 'js', '**', '*.js'),
    ], () => {
        gulp.start('js')
    })

    gulp.watch([
        path.join(__dirname, 'scss', '**', '*.scss'),
    ], () => {
        gulp.start('scss')
    })
})
