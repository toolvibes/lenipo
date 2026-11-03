from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_issue_request import CreateIssueRequest
from ...models.issue import Issue
from ...models.issues_create_format import IssuesCreateFormat
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateIssueRequest,
    format_: IssuesCreateFormat | Unset = IssuesCreateFormat.JSON,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/issues",
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Issue | Problem:
    if response.status_code == 201:
        response_201 = Issue.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Issue | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateIssueRequest,
    format_: IssuesCreateFormat | Unset = IssuesCreateFormat.JSON,

) -> Response[Issue | Problem]:
    """ Create an issue

    Args:
        format_ (IssuesCreateFormat | Unset):  Default: IssuesCreateFormat.JSON.
        body (CreateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | Problem]
     """


    kwargs = _get_kwargs(
        body=body,
format_=format_,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CreateIssueRequest,
    format_: IssuesCreateFormat | Unset = IssuesCreateFormat.JSON,

) -> Issue | Problem | None:
    """ Create an issue

    Args:
        format_ (IssuesCreateFormat | Unset):  Default: IssuesCreateFormat.JSON.
        body (CreateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Issue | Problem
     """


    return sync_detailed(
        client=client,
body=body,
format_=format_,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateIssueRequest,
    format_: IssuesCreateFormat | Unset = IssuesCreateFormat.JSON,

) -> Response[Issue | Problem]:
    """ Create an issue

    Args:
        format_ (IssuesCreateFormat | Unset):  Default: IssuesCreateFormat.JSON.
        body (CreateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | Problem]
     """


    kwargs = _get_kwargs(
        body=body,
format_=format_,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CreateIssueRequest,
    format_: IssuesCreateFormat | Unset = IssuesCreateFormat.JSON,

) -> Issue | Problem | None:
    """ Create an issue

    Args:
        format_ (IssuesCreateFormat | Unset):  Default: IssuesCreateFormat.JSON.
        body (CreateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Issue | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,
format_=format_,

    )).parsed
