from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.issue import Issue
from ...models.issues_update_format import IssuesUpdateFormat
from ...models.problem import Problem
from ...models.update_issue_request import UpdateIssueRequest
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: UpdateIssueRequest,
    format_: IssuesUpdateFormat | Unset = IssuesUpdateFormat.JSON,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/api/v1/issues/{key}".format(key=quote(str(key), safe=""),),
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Issue | Problem:
    if response.status_code == 200:
        response_200 = Issue.from_dict(response.json())



        return response_200

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
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateIssueRequest,
    format_: IssuesUpdateFormat | Unset = IssuesUpdateFormat.JSON,

) -> Response[Issue | Problem]:
    """ Change fields of an issue; every change is recorded in its history

    Args:
        key (str):
        format_ (IssuesUpdateFormat | Unset):  Default: IssuesUpdateFormat.JSON.
        body (UpdateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,
format_=format_,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateIssueRequest,
    format_: IssuesUpdateFormat | Unset = IssuesUpdateFormat.JSON,

) -> Issue | Problem | None:
    """ Change fields of an issue; every change is recorded in its history

    Args:
        key (str):
        format_ (IssuesUpdateFormat | Unset):  Default: IssuesUpdateFormat.JSON.
        body (UpdateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Issue | Problem
     """


    return sync_detailed(
        key=key,
client=client,
body=body,
format_=format_,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateIssueRequest,
    format_: IssuesUpdateFormat | Unset = IssuesUpdateFormat.JSON,

) -> Response[Issue | Problem]:
    """ Change fields of an issue; every change is recorded in its history

    Args:
        key (str):
        format_ (IssuesUpdateFormat | Unset):  Default: IssuesUpdateFormat.JSON.
        body (UpdateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,
format_=format_,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateIssueRequest,
    format_: IssuesUpdateFormat | Unset = IssuesUpdateFormat.JSON,

) -> Issue | Problem | None:
    """ Change fields of an issue; every change is recorded in its history

    Args:
        key (str):
        format_ (IssuesUpdateFormat | Unset):  Default: IssuesUpdateFormat.JSON.
        body (UpdateIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Issue | Problem
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,
format_=format_,

    )).parsed
