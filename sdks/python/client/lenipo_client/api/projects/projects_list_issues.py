from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.issue_list import IssueList
from ...models.problem import Problem
from ...models.projects_list_issues_status import ProjectsListIssuesStatus
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    key: str,
    *,
    status: ProjectsListIssuesStatus | Unset = UNSET,
    assignee: str | Unset = UNSET,
    type_: str | Unset = UNSET,
    q: str | Unset = UNSET,
    limit: int | Unset = 50,
    offset: int | Unset = 0,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params["assignee"] = assignee

    params["type"] = type_

    params["q"] = q

    params["limit"] = limit

    params["offset"] = offset


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/projects/{key}/issues".format(key=quote(str(key), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> IssueList | Problem:
    if response.status_code == 200:
        response_200 = IssueList.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[IssueList | Problem]:
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
    status: ProjectsListIssuesStatus | Unset = UNSET,
    assignee: str | Unset = UNSET,
    type_: str | Unset = UNSET,
    q: str | Unset = UNSET,
    limit: int | Unset = 50,
    offset: int | Unset = 0,

) -> Response[IssueList | Problem]:
    """ List the issues of a project in rank order

    Args:
        key (str):
        status (ProjectsListIssuesStatus | Unset):
        assignee (str | Unset):
        type_ (str | Unset):
        q (str | Unset):
        limit (int | Unset):  Default: 50.
        offset (int | Unset):  Default: 0.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[IssueList | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
status=status,
assignee=assignee,
type_=type_,
q=q,
limit=limit,
offset=offset,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    status: ProjectsListIssuesStatus | Unset = UNSET,
    assignee: str | Unset = UNSET,
    type_: str | Unset = UNSET,
    q: str | Unset = UNSET,
    limit: int | Unset = 50,
    offset: int | Unset = 0,

) -> IssueList | Problem | None:
    """ List the issues of a project in rank order

    Args:
        key (str):
        status (ProjectsListIssuesStatus | Unset):
        assignee (str | Unset):
        type_ (str | Unset):
        q (str | Unset):
        limit (int | Unset):  Default: 50.
        offset (int | Unset):  Default: 0.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        IssueList | Problem
     """


    return sync_detailed(
        key=key,
client=client,
status=status,
assignee=assignee,
type_=type_,
q=q,
limit=limit,
offset=offset,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    status: ProjectsListIssuesStatus | Unset = UNSET,
    assignee: str | Unset = UNSET,
    type_: str | Unset = UNSET,
    q: str | Unset = UNSET,
    limit: int | Unset = 50,
    offset: int | Unset = 0,

) -> Response[IssueList | Problem]:
    """ List the issues of a project in rank order

    Args:
        key (str):
        status (ProjectsListIssuesStatus | Unset):
        assignee (str | Unset):
        type_ (str | Unset):
        q (str | Unset):
        limit (int | Unset):  Default: 50.
        offset (int | Unset):  Default: 0.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[IssueList | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
status=status,
assignee=assignee,
type_=type_,
q=q,
limit=limit,
offset=offset,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    status: ProjectsListIssuesStatus | Unset = UNSET,
    assignee: str | Unset = UNSET,
    type_: str | Unset = UNSET,
    q: str | Unset = UNSET,
    limit: int | Unset = 50,
    offset: int | Unset = 0,

) -> IssueList | Problem | None:
    """ List the issues of a project in rank order

    Args:
        key (str):
        status (ProjectsListIssuesStatus | Unset):
        assignee (str | Unset):
        type_ (str | Unset):
        q (str | Unset):
        limit (int | Unset):  Default: 50.
        offset (int | Unset):  Default: 0.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        IssueList | Problem
     """


    return (await asyncio_detailed(
        key=key,
client=client,
status=status,
assignee=assignee,
type_=type_,
q=q,
limit=limit,
offset=offset,

    )).parsed
