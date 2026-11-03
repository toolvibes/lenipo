from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.project_custom_fields_request import ProjectCustomFieldsRequest
from ...models.project_details import ProjectDetails
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: ProjectCustomFieldsRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/projects/{key}/custom-fields".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | ProjectDetails:
    if response.status_code == 200:
        response_200 = ProjectDetails.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | ProjectDetails]:
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
    body: ProjectCustomFieldsRequest,

) -> Response[Problem | ProjectDetails]:
    """ Choose the custom fields a project uses, in display order

     Requires the project permission `administer`. Values of fields switched off stay stored but are
    hidden (E-50). `settings` makes fields required, hidden from forms, or gives them help text (TL-12);
    a field cannot be both required and hidden.

    Args:
        key (str):
        body (ProjectCustomFieldsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectDetails]
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
    body: ProjectCustomFieldsRequest,

) -> Problem | ProjectDetails | None:
    """ Choose the custom fields a project uses, in display order

     Requires the project permission `administer`. Values of fields switched off stay stored but are
    hidden (E-50). `settings` makes fields required, hidden from forms, or gives them help text (TL-12);
    a field cannot be both required and hidden.

    Args:
        key (str):
        body (ProjectCustomFieldsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectDetails
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
    body: ProjectCustomFieldsRequest,

) -> Response[Problem | ProjectDetails]:
    """ Choose the custom fields a project uses, in display order

     Requires the project permission `administer`. Values of fields switched off stay stored but are
    hidden (E-50). `settings` makes fields required, hidden from forms, or gives them help text (TL-12);
    a field cannot be both required and hidden.

    Args:
        key (str):
        body (ProjectCustomFieldsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectDetails]
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
    body: ProjectCustomFieldsRequest,

) -> Problem | ProjectDetails | None:
    """ Choose the custom fields a project uses, in display order

     Requires the project permission `administer`. Values of fields switched off stay stored but are
    hidden (E-50). `settings` makes fields required, hidden from forms, or gives them help text (TL-12);
    a field cannot be both required and hidden.

    Args:
        key (str):
        body (ProjectCustomFieldsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectDetails
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
