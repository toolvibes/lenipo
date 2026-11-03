from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_worklog_request import CreateWorklogRequest
from ...models.problem import Problem
from ...models.worklog import Worklog
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: CreateWorklogRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/issues/{key}/worklogs".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | Worklog:
    if response.status_code == 201:
        response_201 = Worklog.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | Worklog]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateWorklogRequest,

) -> Response[Problem | Worklog]:
    """ Log work on an issue

     Needs `edit-issues`. Durations like "1d 4h" use the instance’s working time (`workingTime` in
    /tracking/meta). The remaining estimate drops by the logged time unless `remaining` says otherwise.

    Args:
        key (str):
        body (CreateWorklogRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Worklog]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateWorklogRequest,

) -> Problem | Worklog | None:
    """ Log work on an issue

     Needs `edit-issues`. Durations like "1d 4h" use the instance’s working time (`workingTime` in
    /tracking/meta). The remaining estimate drops by the logged time unless `remaining` says otherwise.

    Args:
        key (str):
        body (CreateWorklogRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Worklog
     """


    return sync_detailed(
        key=key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateWorklogRequest,

) -> Response[Problem | Worklog]:
    """ Log work on an issue

     Needs `edit-issues`. Durations like "1d 4h" use the instance’s working time (`workingTime` in
    /tracking/meta). The remaining estimate drops by the logged time unless `remaining` says otherwise.

    Args:
        key (str):
        body (CreateWorklogRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Worklog]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateWorklogRequest,

) -> Problem | Worklog | None:
    """ Log work on an issue

     Needs `edit-issues`. Durations like "1d 4h" use the instance’s working time (`workingTime` in
    /tracking/meta). The remaining estimate drops by the logged time unless `remaining` says otherwise.

    Args:
        key (str):
        body (CreateWorklogRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Worklog
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
