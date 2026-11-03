from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.import_confluence_body import ImportConfluenceBody
from ...models.import_confluence_dry_run import ImportConfluenceDryRun
from ...models.import_job import ImportJob
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: ImportConfluenceBody,
    space_key: str | Unset = UNSET,
    dry_run: ImportConfluenceDryRun | Unset = ImportConfluenceDryRun.TRUE,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    params: dict[str, Any] = {}

    params["spaceKey"] = space_key

    json_dry_run: str | Unset = UNSET
    if not isinstance(dry_run, Unset):
        json_dry_run = dry_run.value

    params["dryRun"] = json_dry_run


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/admin/imports/confluence",
        "params": params,
    }

    _kwargs["files"] = body.to_multipart()

    headers["Content-Type"] = "multipart/form-data; boundary=+++"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ImportJob | Problem:
    if response.status_code == 201:
        response_201 = ImportJob.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ImportJob | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ImportConfluenceBody,
    space_key: str | Unset = UNSET,
    dry_run: ImportConfluenceDryRun | Unset = ImportConfluenceDryRun.TRUE,

) -> Response[ImportJob | Problem]:
    """ Import a Confluence Server/DC space export

     The space XML export as a ZIP (field "file"). Pages with their versions, blog posts, comments,
    attachments and labels; Confluence macros become Lenipo macros where one exists. `spaceKey` names
    the new space (the export's key by default); dryRun (the default) only reports.

    Requires the global permission `admin`.

    Args:
        space_key (str | Unset):
        dry_run (ImportConfluenceDryRun | Unset):  Default: ImportConfluenceDryRun.TRUE.
        body (ImportConfluenceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ImportJob | Problem]
     """


    kwargs = _get_kwargs(
        body=body,
space_key=space_key,
dry_run=dry_run,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: ImportConfluenceBody,
    space_key: str | Unset = UNSET,
    dry_run: ImportConfluenceDryRun | Unset = ImportConfluenceDryRun.TRUE,

) -> ImportJob | Problem | None:
    """ Import a Confluence Server/DC space export

     The space XML export as a ZIP (field "file"). Pages with their versions, blog posts, comments,
    attachments and labels; Confluence macros become Lenipo macros where one exists. `spaceKey` names
    the new space (the export's key by default); dryRun (the default) only reports.

    Requires the global permission `admin`.

    Args:
        space_key (str | Unset):
        dry_run (ImportConfluenceDryRun | Unset):  Default: ImportConfluenceDryRun.TRUE.
        body (ImportConfluenceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ImportJob | Problem
     """


    return sync_detailed(
        client=client,
body=body,
space_key=space_key,
dry_run=dry_run,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ImportConfluenceBody,
    space_key: str | Unset = UNSET,
    dry_run: ImportConfluenceDryRun | Unset = ImportConfluenceDryRun.TRUE,

) -> Response[ImportJob | Problem]:
    """ Import a Confluence Server/DC space export

     The space XML export as a ZIP (field "file"). Pages with their versions, blog posts, comments,
    attachments and labels; Confluence macros become Lenipo macros where one exists. `spaceKey` names
    the new space (the export's key by default); dryRun (the default) only reports.

    Requires the global permission `admin`.

    Args:
        space_key (str | Unset):
        dry_run (ImportConfluenceDryRun | Unset):  Default: ImportConfluenceDryRun.TRUE.
        body (ImportConfluenceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ImportJob | Problem]
     """


    kwargs = _get_kwargs(
        body=body,
space_key=space_key,
dry_run=dry_run,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: ImportConfluenceBody,
    space_key: str | Unset = UNSET,
    dry_run: ImportConfluenceDryRun | Unset = ImportConfluenceDryRun.TRUE,

) -> ImportJob | Problem | None:
    """ Import a Confluence Server/DC space export

     The space XML export as a ZIP (field "file"). Pages with their versions, blog posts, comments,
    attachments and labels; Confluence macros become Lenipo macros where one exists. `spaceKey` names
    the new space (the export's key by default); dryRun (the default) only reports.

    Requires the global permission `admin`.

    Args:
        space_key (str | Unset):
        dry_run (ImportConfluenceDryRun | Unset):  Default: ImportConfluenceDryRun.TRUE.
        body (ImportConfluenceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ImportJob | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,
space_key=space_key,
dry_run=dry_run,

    )).parsed
