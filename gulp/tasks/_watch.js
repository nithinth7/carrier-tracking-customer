'use strict';

var gulp  = require('gulp'),
  paths = require('../config').paths;

gulp.task('styles:watch', function () {
  // gulp.watch([paths.source.styles, '!' + paths.source.footer], gulp.series('styles', 'rev', 'templates', 'server:reload'));

  gulp.watch(
    // [paths.source.styles, '!' + paths.destination.sprite.scss + '_inline-dimensions.scss'],
    [paths.source.styles, '!' + paths.destination.sprite.scss + '_sprite.scss', '!' + paths.destination.sprite.scss + '_inline-dimensions.scss'],

    gulp.series('styles', 'rev', 'templates', 'server:reload')
  );
});

gulp.task('scripts:watch', function () {
  // gulp.watch([paths.source.jshint, '!' + paths.source.footer], gulp.series('scripts:clean', 'scripts', 'rev', 'templates', 'server:reload'));
  gulp.watch([paths.source.jshint], gulp.series('scripts:clean', 'scripts', 'rev', 'templates', 'server:reload'));
});

gulp.task('images:watch', function () {
  // gulp.watch([paths.source.templates, '!' + paths.source.footer], gulp.series('templates', 'server:reload'));
  gulp.watch([paths.source.templates], gulp.series('templates', 'server:reload'));
});

gulp.task('copy:watch', function () {
  // gulp.watch([paths.source.copy, '!' + paths.source.footer], gulp.series('copy', 'server:reload'));
  gulp.watch([paths.source.copy], gulp.series('copy', 'server:reload'));
});

/*******************************************************************************
 * WATCH TASK
 *
 * kicks off the watcher for JS, CSS, HTML files
 * for easy and instant development
 *
 * @todo: use files argument to just update touched files!
 */

gulp.task('watch', gulp.parallel('styles:watch', 'scripts:watch', 'images:watch', 'copy:watch'));
