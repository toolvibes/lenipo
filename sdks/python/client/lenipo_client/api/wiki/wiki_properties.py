from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.page_properties_report import PagePropertiesReport
from ...models.problem import Problem
from ...models.wiki_properties_assignee import WikiPropertiesAssignee
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    space: str | Unset = UNSET,
    label: str | Unset = UNSET,
    limit: int | Unset = 10,
    assignee: WikiPropertiesAssignee | Unset = WikiPropertiesAssignee.ALL,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["space"] = space

    params["label"] = label

    params["limit"] = limit

    json_assignee: str | Unset = UNSET
    if not isinstance(assignee, Unset):
        json_assignee = assignee.value

    params["assignee"] = json_assignee


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/wiki/page-properties",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PagePropertiesReport | Problem:
    if response.status_code == 200:
        response_200 = PagePropertiesReport.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PagePropertiesReport | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,
    label: str | Unset = UNSET,
    limit: int | Unset = 10,
    assignee: WikiPropertiesAssignee | Unset = WikiPropertiesAssignee.ALL,

) -> Response[PagePropertiesReport | Problem]:
    """ Page properties of the pages with a label, as one table

    Args:
        space (str | Unset):
        label (str | Unset):
        limit (int | Unset):  Default: 10.
        assignee (WikiPropertiesAssignee | Unset):  Default: WikiPropertiesAssignee.ALL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PagePropertiesReport | Problem]
     """


    kwargs = _get_kwargs(
        space=space,
label=label,
limit=limit,
assignee=assignee,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,
    label: str | Unset = UNSET,
    limit: int | Unset = 10,
    assignee: WikiPropertiesAssignee | Unset = WikiPropertiesAssignee.ALL,

) -> PagePropertiesReport | Problem | None:
    """ Page properties of the pages with a label, as one table

    Args:
        space (str | Unset):
        label (str | Unset):
        limit (int | Unset):  Default: 10.
        assignee (WikiPropertiesAssignee | Unset):  Default: WikiPropertiesAssignee.ALL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PagePropertiesReport | Problem
     """


    return sync_detailed(
        client=client,
space=space,
label=label,
limit=limit,
assignee=assignee,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,
    label: str | Unset = UNSET,
    limit: int | Unset = 10,
    assignee: WikiPropertiesAssignee | Unset = WikiPropertiesAssignee.ALL,

) -> Response[PagePropertiesReport | Problem]:
    """ Page properties of the pages with a label, as one table

    Args:
        space (str | Unset):
        label (str | Unset):
        limit (int | Unset):  Default: 10.
        assignee (WikiPropertiesAssignee | Unset):  Default: WikiPropertiesAssignee.ALL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PagePropertiesReport | Problem]
     """


    kwargs = _get_kwargs(
        space=space,
label=label,
limit=limit,
assignee=assignee,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,
    label: str | Unset = UNSET,
    limit: int | Unset = 10,
    assignee: WikiPropertiesAssignee | Unset = WikiPropertiesAssignee.ALL,

) -> PagePropertiesReport | Problem | None:
    """ Page properties of the pages with a label, as one table

    Args:
        space (str | Unset):
        label (str | Unset):
        limit (int | Unset):  Default: 10.
        assignee (WikiPropertiesAssignee | Unset):  Default: WikiPropertiesAssignee.ALL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PagePropertiesReport | Problem
     """


    return (await asyncio_detailed(
        client=client,
space=space,
label=label,
limit=limit,
assignee=assignee,

    )).parsed
