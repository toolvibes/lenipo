from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.issue import Issue
from ...models.issue_approval import IssueApproval
from ...models.issues_transition_format import IssuesTransitionFormat
from ...models.problem import Problem
from ...models.transition_request import TransitionRequest
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: TransitionRequest,
    format_: IssuesTransitionFormat | Unset = IssuesTransitionFormat.JSON,

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
        "url": "/api/v1/issues/{key}/transitions".format(key=quote(str(key), safe=""),),
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Issue | IssueApproval | Problem:
    if response.status_code == 200:
        response_200 = Issue.from_dict(response.json())



        return response_200

    if response.status_code == 202:
        response_202 = IssueApproval.from_dict(response.json())



        return response_202

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Issue | IssueApproval | Problem]:
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
    body: TransitionRequest,
    format_: IssuesTransitionFormat | Unset = IssuesTransitionFormat.JSON,

) -> Response[Issue | IssueApproval | Problem]:
    """ Move an issue to another status

     Where the project keeps the target status for people, an agent gets 202 with the waiting request
    instead; the move happens once a person approves it.

    Args:
        key (str):
        format_ (IssuesTransitionFormat | Unset):  Default: IssuesTransitionFormat.JSON.
        body (TransitionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | IssueApproval | Problem]
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
    body: TransitionRequest,
    format_: IssuesTransitionFormat | Unset = IssuesTransitionFormat.JSON,

) -> Issue | IssueApproval | Problem | None:
    """ Move an issue to another status

     Where the project keeps the target status for people, an agent gets 202 with the waiting request
    instead; the move happens once a person approves it.

    Args:
        key (str):
        format_ (IssuesTransitionFormat | Unset):  Default: IssuesTransitionFormat.JSON.
        body (TransitionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Issue | IssueApproval | Problem
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
    body: TransitionRequest,
    format_: IssuesTransitionFormat | Unset = IssuesTransitionFormat.JSON,

) -> Response[Issue | IssueApproval | Problem]:
    """ Move an issue to another status

     Where the project keeps the target status for people, an agent gets 202 with the waiting request
    instead; the move happens once a person approves it.

    Args:
        key (str):
        format_ (IssuesTransitionFormat | Unset):  Default: IssuesTransitionFormat.JSON.
        body (TransitionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Issue | IssueApproval | Problem]
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
    body: TransitionRequest,
    format_: IssuesTransitionFormat | Unset = IssuesTransitionFormat.JSON,

) -> Issue | IssueApproval | Problem | None:
    """ Move an issue to another status

     Where the project keeps the target status for people, an agent gets 202 with the waiting request
    instead; the move happens once a person approves it.

    Args:
        key (str):
        format_ (IssuesTransitionFormat | Unset):  Default: IssuesTransitionFormat.JSON.
        body (TransitionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Issue | IssueApproval | Problem
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,
format_=format_,

    )).parsed
