from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.issue import Issue
from ...models.move_issue_request import MoveIssueRequest
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: MoveIssueRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/issues/{key}/move".format(key=quote(str(key), safe=""),),
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
    body: MoveIssueRequest,

) -> Response[Issue | Problem]:
    """ Move an issue with its subtasks to another project

     New keys, the old ones keep working. Type and status are kept where the target allows, else mapped
    (same category, else initial); components and versions by name; security level kept or the target
    default. Needs edit-issues in the source and create-issues in the target.

    Args:
        key (str):
        body (MoveIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | Problem]
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
    body: MoveIssueRequest,

) -> Issue | Problem | None:
    """ Move an issue with its subtasks to another project

     New keys, the old ones keep working. Type and status are kept where the target allows, else mapped
    (same category, else initial); components and versions by name; security level kept or the target
    default. Needs edit-issues in the source and create-issues in the target.

    Args:
        key (str):
        body (MoveIssueRequest):

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

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: MoveIssueRequest,

) -> Response[Issue | Problem]:
    """ Move an issue with its subtasks to another project

     New keys, the old ones keep working. Type and status are kept where the target allows, else mapped
    (same category, else initial); components and versions by name; security level kept or the target
    default. Needs edit-issues in the source and create-issues in the target.

    Args:
        key (str):
        body (MoveIssueRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | Problem]
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
    body: MoveIssueRequest,

) -> Issue | Problem | None:
    """ Move an issue with its subtasks to another project

     New keys, the old ones keep working. Type and status are kept where the target allows, else mapped
    (same category, else initial); components and versions by name; security level kept or the target
    default. Needs edit-issues in the source and create-issues in the target.

    Args:
        key (str):
        body (MoveIssueRequest):

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

    )).parsed
