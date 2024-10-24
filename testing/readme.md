# @potami/testing

A module for Potami that includes helpful testing utilties.

In contrast to other more opinionated HTTP server solutions, Potami doesn't require a bunch of mocking for providers, injection services, etc. However, for some testing you may find yourself repeating the same patterns. This module exists to provide helpers for those tasks to reduce duplication and make your tests more resilient to updates to Potami's API.